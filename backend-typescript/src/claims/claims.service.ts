import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClaimsService {
  constructor(private prisma: PrismaService) {}

  // --- Return Reasons ---

  async createReturnReason(companyId: string, data: { code: string; name: string; description?: string }) {
    return this.prisma.returnReason.create({
      data: {
        company_id: companyId,
        code: data.code,
        name: data.name,
        description: data.description,
      }
    });
  }

  async getReturnReasons(companyId: string) {
    return this.prisma.returnReason.findMany({
      where: { company_id: companyId, is_active: true }
    });
  }

  // --- Claims ---

  async createClaim(companyId: string, userId: string, data: any) {
    // Basic structural validation
    if (!data.party_id) throw new BadRequestException('Party ID is required');
    if (!['CUSTOMER_CLAIM', 'SUPPLIER_CLAIM'].includes(data.claim_type)) {
      throw new BadRequestException('Invalid claim type');
    }

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = new Prisma.Decimal(0);
      const lines = (data.lines || []).map((l: any) => {
        const qty = new Prisma.Decimal(l.quantity || 0);
        const rate = new Prisma.Decimal(l.rate || 0);
        const amount = qty.mul(rate);
        totalAmount = totalAmount.add(amount);

        return {
          item_id: l.item_id,
          unit_id: l.unit_id,
          quantity: qty,
          rate: rate,
          amount: amount,
          notes: l.notes
        };
      });

      const claim = await tx.claim.create({
        data: {
          company_id: companyId,
          branch_id: data.branch_id,
          party_id: data.party_id,
          claim_type: data.claim_type,
          document_number: data.document_number,
          document_date: new Date(data.document_date),
          status: 'OPEN',
          reason_id: data.reason_id,
          notes: data.notes,
          total_amount: totalAmount,
          sales_invoice_id: data.sales_invoice_id,
          purchase_invoice_id: data.purchase_invoice_id,
          sales_return_id: data.sales_return_id,
          purchase_return_id: data.purchase_return_id,
          created_by: userId,
          lines: { create: lines }
        },
        include: { lines: true }
      });

      await tx.claimEvent.create({
        data: {
          claim_id: claim.id,
          user_id: userId,
          event_type: 'CREATED',
          new_status: 'OPEN',
          notes: 'Claim initiated'
        }
      });

      return claim;
    });
  }

  async getClaims(companyId: string, filters: any) {
    return this.prisma.claim.findMany({
      where: {
        company_id: companyId,
        claim_type: filters.claim_type,
        status: filters.status
      },
      include: {
        party: true,
        reason: true
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async getClaimById(companyId: string, id: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: {
        lines: { include: { item: true, unit: true } },
        events: { include: { user: true }, orderBy: { created_at: 'asc' } },
        party: true,
        reason: true,
        creator: true,
        approver: true,
        settler: true
      }
    });

    if (!claim || claim.company_id !== companyId) {
      throw new NotFoundException('Claim not found');
    }

    return claim;
  }

  async updateClaimStatus(companyId: string, id: string, userId: string, newStatus: string, notes?: string) {
    const validStatuses = ['OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED', 'CLOSED'];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException('Invalid status');
    }

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUnique({ where: { id } });
      if (!claim || claim.company_id !== companyId) {
        throw new NotFoundException('Claim not found');
      }

      if (claim.status === 'CLOSED' || claim.status === 'SETTLED') {
        throw new BadRequestException(`Cannot change status of a ${claim.status} claim`);
      }

      const updateData: any = { status: newStatus };
      if (newStatus === 'APPROVED') {
        updateData.approved_by = userId;
        updateData.approved_at = new Date();
      } else if (newStatus === 'SETTLED') {
        updateData.settled_by = userId;
        updateData.settled_at = new Date();
      }

      const updatedClaim = await tx.claim.update({
        where: { id },
        data: updateData
      });

      await tx.claimEvent.create({
        data: {
          claim_id: claim.id,
          user_id: userId,
          event_type: 'STATUS_CHANGED',
          old_status: claim.status,
          new_status: newStatus,
          notes: notes
        }
      });

      return updatedClaim;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }
}
