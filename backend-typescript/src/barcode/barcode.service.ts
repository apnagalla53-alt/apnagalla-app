import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AssignBarcodeDto } from './dto/assign-barcode.dto';
import { GenerateBarcodeDto } from './dto/generate-barcode.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BarcodeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign or update a barcode for an item.
   * Enforces company-scoped uniqueness, deterministically normalizes input,
   * handles primary barcode rules atomically, and records audit logs.
   */
  async assignBarcode(companyId: string, userId: string, dto: AssignBarcodeDto) {
    const rawBarcode = dto.barcode;
    if (!rawBarcode || typeof rawBarcode !== 'string' || !rawBarcode.trim()) {
      throw new BadRequestException('Barcode cannot be empty or whitespace');
    }
    const normalizedBarcode = rawBarcode.trim();

    // 1. Verify item exists, belongs to company, and is active
    const item = await this.prisma.item.findUnique({
      where: { id: dto.item_id },
    });

    if (!item || item.company_id !== companyId) {
      throw new NotFoundException('Item not found or belongs to another company');
    }
    if (!item.is_active) {
      throw new BadRequestException('Cannot assign barcode to an inactive item');
    }

    return this.prisma.$transaction(async (tx) => {
      // 2. Check if this barcode already exists in the company
      const existing = await tx.itemBarcode.findFirst({
        where: {
          company_id: companyId,
          barcode: normalizedBarcode,
        },
      });

      if (existing) {
        if (existing.item_id !== dto.item_id) {
          throw new ConflictException(
            `Barcode "${normalizedBarcode}" is already assigned to another item in this company`
          );
        }

        // Idempotent assignment for the same item
        let shouldBePrimary = dto.is_primary ?? existing.is_primary;
        if (shouldBePrimary && !existing.is_primary) {
          await tx.itemBarcode.updateMany({
            where: { item_id: dto.item_id, is_primary: true },
            data: { is_primary: false },
          });
        }

        const updated = await tx.itemBarcode.update({
          where: { id: existing.id },
          data: {
            barcode_type: dto.barcode_type || existing.barcode_type,
            is_primary: shouldBePrimary,
            is_active: true,
          },
        });

        await tx.auditLog.create({
          data: {
            company_id: companyId,
            user_id: userId,
            action: 'ITEM_BARCODE_UPDATED',
            source_document_type: 'Item',
            source_document_id: dto.item_id,
            details: JSON.stringify({
              barcode_id: updated.id,
              barcode: updated.barcode,
              barcode_type: updated.barcode_type,
              is_primary: updated.is_primary,
            }),
          },
        });

        return updated;
      }

      // Check existing barcodes count for primary logic
      const existingCount = await tx.itemBarcode.count({
        where: { item_id: dto.item_id, is_active: true },
      });

      // Default to primary if this is the first barcode for the item
      const isPrimary = dto.is_primary !== undefined ? dto.is_primary : existingCount === 0;

      if (isPrimary) {
        await tx.itemBarcode.updateMany({
          where: { item_id: dto.item_id, is_primary: true },
          data: { is_primary: false },
        });
      }

      const created = await tx.itemBarcode.create({
        data: {
          company_id: companyId,
          item_id: dto.item_id,
          barcode: normalizedBarcode,
          barcode_type: dto.barcode_type || 'CODE128',
          is_primary: isPrimary,
          is_active: true,
        },
      });

      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: userId,
          action: 'ITEM_BARCODE_CREATED',
          source_document_type: 'Item',
          source_document_id: dto.item_id,
          details: JSON.stringify({
            barcode_id: created.id,
            barcode: created.barcode,
            barcode_type: created.barcode_type,
            is_primary: created.is_primary,
          }),
        },
      });

      return created;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Retrieve all barcodes for an item.
   */
  async getBarcodesByItem(companyId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
    });
    if (!item || item.company_id !== companyId) {
      throw new NotFoundException('Item not found or belongs to another company');
    }

    return this.prisma.itemBarcode.findMany({
      where: { company_id: companyId, item_id: itemId },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'desc' }],
    });
  }

  /**
   * Canonical barcode lookup.
   * Resolves to exactly one active item or returns an error.
   */
  async lookupBarcode(companyId: string, barcode: string) {
    const normalized = (barcode || '').trim();
    if (!normalized) {
      throw new BadRequestException('Barcode cannot be empty');
    }

    const record = await this.prisma.itemBarcode.findFirst({
      where: {
        company_id: companyId,
        barcode: normalized,
        is_active: true,
      },
      include: {
        item: {
          include: {
            primary_unit: true,
            tax_class: true,
            barcodes: {
              where: { is_active: true },
            },
          },
        },
      },
    });

    if (!record || !record.item) {
      // Fallback to SKU lookup
      const item = await this.prisma.item.findFirst({
        where: {
          company_id: companyId,
          sku: normalized,
          is_active: true,
        },
        include: {
          primary_unit: true,
          tax_class: true,
          barcodes: {
            where: { is_active: true },
          },
        },
      });

      if (!item) {
        throw new BadRequestException('Item not found or inactive');
      }
      return item;
    }

    if (!record.item.is_active) {
      throw new BadRequestException('Item not found or inactive');
    }

    return record.item;
  }

  /**
   * Set a specific barcode as primary for its item.
   */
  async setPrimaryBarcode(companyId: string, userId: string, barcodeId: string) {
    const barcodeRecord = await this.prisma.itemBarcode.findUnique({
      where: { id: barcodeId },
    });

    if (!barcodeRecord || barcodeRecord.company_id !== companyId) {
      throw new NotFoundException('Barcode not found or belongs to another company');
    }
    if (!barcodeRecord.is_active) {
      throw new BadRequestException('Cannot set an inactive barcode as primary');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.itemBarcode.updateMany({
        where: { item_id: barcodeRecord.item_id, is_primary: true },
        data: { is_primary: false },
      });

      const updated = await tx.itemBarcode.update({
        where: { id: barcodeId },
        data: { is_primary: true },
      });

      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: userId,
          action: 'ITEM_BARCODE_UPDATED',
          source_document_type: 'Item',
          source_document_id: barcodeRecord.item_id,
          details: JSON.stringify({
            barcode_id: updated.id,
            action: 'SET_PRIMARY',
            barcode: updated.barcode,
          }),
        },
      });

      return updated;
    });
  }

  /**
   * Deactivate a barcode (soft delete).
   */
  async deactivateBarcode(companyId: string, userId: string, barcodeId: string) {
    const barcodeRecord = await this.prisma.itemBarcode.findUnique({
      where: { id: barcodeId },
    });

    if (!barcodeRecord || barcodeRecord.company_id !== companyId) {
      throw new NotFoundException('Barcode not found or belongs to another company');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.itemBarcode.update({
        where: { id: barcodeId },
        data: { is_active: false, is_primary: false },
      });

      // If this was primary, set another active barcode as primary if available
      const remaining = await tx.itemBarcode.findFirst({
        where: { item_id: barcodeRecord.item_id, is_active: true },
        orderBy: { created_at: 'asc' },
      });
      if (remaining) {
        await tx.itemBarcode.update({
          where: { id: remaining.id },
          data: { is_primary: true },
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: userId,
          action: 'ITEM_BARCODE_DEACTIVATED',
          source_document_type: 'Item',
          source_document_id: barcodeRecord.item_id,
          details: JSON.stringify({
            barcode_id: updated.id,
            barcode: updated.barcode,
          }),
        },
      });

      return updated;
    });
  }

  /**
   * Delete a barcode record.
   */
  async deleteBarcode(companyId: string, userId: string, barcodeId: string) {
    const barcodeRecord = await this.prisma.itemBarcode.findUnique({
      where: { id: barcodeId },
    });

    if (!barcodeRecord || barcodeRecord.company_id !== companyId) {
      throw new NotFoundException('Barcode not found or belongs to another company');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.itemBarcode.delete({
        where: { id: barcodeId },
      });

      if (barcodeRecord.is_primary) {
        const remaining = await tx.itemBarcode.findFirst({
          where: { item_id: barcodeRecord.item_id, is_active: true },
          orderBy: { created_at: 'asc' },
        });
        if (remaining) {
          await tx.itemBarcode.update({
            where: { id: remaining.id },
            data: { is_primary: true },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: userId,
          action: 'ITEM_BARCODE_DEACTIVATED',
          source_document_type: 'Item',
          source_document_id: barcodeRecord.item_id,
          details: JSON.stringify({
            deleted_barcode_id: barcodeId,
            barcode: barcodeRecord.barcode,
          }),
        },
      });

      return { success: true };
    });
  }

  /**
   * Collision-safe barcode generation.
   * Generates EAN-13 (with standard Modulo-10 checksum) or CODE-128 / INTERNAL barcodes.
   * Strictly presentation/master utility — does NOT mutate inventory or transactions.
   */
  async generateBarcode(companyId: string, dto: GenerateBarcodeDto) {
    const type = dto.type || 'CODE128';
    let candidate = '';
    let isCollision = true;
    let attempts = 0;

    while (isCollision && attempts < 10) {
      attempts++;
      if (type === 'EAN13') {
        // EAN-13: 12 numeric digits + 1 checksum digit
        // Prefix with standard country/company code (e.g. 890 for India)
        const prefix = dto.prefix ? dto.prefix.replace(/\D/g, '').slice(0, 3) : '890';
        const paddedPrefix = prefix.padEnd(3, '0');
        const randomDigits = Math.floor(Math.random() * 1000000000)
          .toString()
          .padStart(9, '0');
        const base12 = `${paddedPrefix}${randomDigits}`;

        // Calculate Modulo 10 checksum
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          const digit = parseInt(base12[i], 10);
          sum += i % 2 === 0 ? digit : digit * 3;
        }
        const checksum = (10 - (sum % 10)) % 10;
        candidate = `${base12}${checksum}`;
      } else {
        // CODE128 or INTERNAL
        const prefix = dto.prefix || 'EVX';
        const timePart = Date.now().toString().slice(-7);
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        candidate = `${prefix}-${timePart}${randomPart}`;
      }

      // Check collision within company
      const existing = await this.prisma.itemBarcode.findFirst({
        where: { company_id: companyId, barcode: candidate },
      });

      if (!existing) {
        isCollision = false;
      }
    }

    if (isCollision) {
      throw new ConflictException('Failed to generate a collision-free barcode. Please try again.');
    }

    return {
      barcode: candidate,
      barcode_type: type,
    };
  }
}
