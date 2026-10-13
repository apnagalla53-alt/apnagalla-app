import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GenerateProductLabelDto, RecordPrintJobDto } from './dto/print-label.dto';
import { InwardLabelRequestDto } from './dto/inward-label.dto';
import { CreateLabelTemplateDto, UpdateLabelTemplateDto } from './dto/label-template.dto';
import { escapeHtml } from '../common/html';

@Injectable()
export class BarcodePrintService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate presentation payload for product labels.
   * STRICT INVARIANT: Presentation only. Zero inventory movements, zero accounting vouchers.
   */
  async generateProductLabel(companyId: string, userId: string, dto: GenerateProductLabelDto) {
    if (!dto.quantity || dto.quantity < 1) {
      throw new BadRequestException('Label quantity must be at least 1');
    }

    const item = await this.prisma.item.findUnique({
      where: { id: dto.item_id },
      include: {
        company: { select: { legal_name: true, trade_name: true } },
        primary_unit: true,
        tax_class: true,
        barcodes: { where: { is_active: true } },
      },
    });

    if (!item || item.company_id !== companyId) {
      throw new NotFoundException('Item not found or belongs to another company');
    }

    // Determine barcode value
    let targetBarcode = '';
    let barcodeType = 'CODE128';

    if (dto.barcode_id) {
      const selected = item.barcodes.find((b) => b.id === dto.barcode_id);
      if (!selected) {
        throw new BadRequestException('Specified barcode not found or inactive for this item');
      }
      targetBarcode = selected.barcode;
      barcodeType = selected.barcode_type;
    } else {
      const primary = item.barcodes.find((b) => b.is_primary) || item.barcodes[0];
      targetBarcode = primary ? primary.barcode : item.sku;
      barcodeType = primary ? primary.barcode_type : 'CODE128';
    }

    // Resolve template
    let template = null;
    if (dto.template_id) {
      template = await this.prisma.labelTemplate.findUnique({
        where: { id: dto.template_id },
      });
      if (!template || template.company_id !== companyId || !template.is_active) {
        throw new BadRequestException('Invalid or inactive label template');
      }
    } else {
      template = await this.prisma.labelTemplate.findFirst({
        where: { company_id: companyId, is_default: true, is_active: true },
      });
    }

    const widthMm = template ? Number(template.width_mm) : 50;
    const heightMm = template ? Number(template.height_mm) : 25;
    const paperType = template ? template.paper_type : 'ROLL';

    // Build printable HTML representation
    const printableHtml = this.generateHtmlLayout({
      title: item.name,
      sku: item.sku,
      barcode: targetBarcode,
      barcodeType,
      unit: item.primary_unit?.name || 'Unit',
      mrp: item.mrp ? Number(item.mrp) : 0,
      saleRate: item.default_sale_rate ? Number(item.default_sale_rate) : 0,
      companyName: item.company.trade_name || item.company.legal_name,
      widthMm,
      heightMm,
      quantity: dto.quantity,
    });

    // Build thermal ZPL (Zebra) command payload
    const zplPayload = this.generateZplPayload({
      title: item.name,
      sku: item.sku,
      barcode: targetBarcode,
      mrp: item.mrp ? Number(item.mrp) : 0,
      saleRate: item.default_sale_rate ? Number(item.default_sale_rate) : 0,
      quantity: dto.quantity,
      widthMm,
      heightMm,
    });

    // Build thermal ESC/POS command representation
    const escPosPayload = this.generateEscPosPayload({
      title: item.name,
      barcode: targetBarcode,
      mrp: item.mrp ? Number(item.mrp) : 0,
      quantity: dto.quantity,
    });

    // Audit log for label generation
    await this.prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: userId,
        action: 'LABEL_GENERATED',
        source_document_type: 'Item',
        source_document_id: item.id,
        details: JSON.stringify({
          item_id: item.id,
          sku: item.sku,
          barcode: targetBarcode,
          quantity: dto.quantity,
          template_id: template?.id || null,
        }),
      },
    });

    return {
      item_id: item.id,
      item_name: item.name,
      sku: item.sku,
      barcode: targetBarcode,
      barcode_type: barcodeType,
      quantity: dto.quantity,
      mrp: item.mrp ? Number(item.mrp) : 0,
      sale_rate: item.default_sale_rate ? Number(item.default_sale_rate) : 0,
      template: {
        width_mm: widthMm,
        height_mm: heightMm,
        paper_type: paperType,
      },
      printable_html: printableHtml,
      thermal_payload: {
        zpl: zplPayload,
        escpos: escPosPayload,
      },
    };
  }

  /**
   * Generate inward labels directly linked to a Goods Receipt (GRN).
   * Validates received quantities, prevents over-printing, records GRN lineage.
   * STRICT INVARIANT: Zero inventory movements, zero accounting vouchers.
   */
  async generateInwardLabels(companyId: string, userId: string, dto: InwardLabelRequestDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('At least one goods receipt line must be selected');
    }

    const grn = await this.prisma.goodsReceipt.findUnique({
      where: { id: dto.goods_receipt_id },
      include: {
        party: true,
        lines: {
          include: {
            item: {
              include: {
                barcodes: { where: { is_active: true } },
                primary_unit: true,
              },
            },
          },
        },
      },
    });

    if (!grn || grn.company_id !== companyId) {
      throw new NotFoundException('Goods Receipt not found or belongs to another company');
    }

    const labels: any[] = [];

    for (const reqLine of dto.lines) {
      if (!reqLine.quantity || reqLine.quantity < 1) {
        throw new BadRequestException('Label quantity must be at least 1');
      }

      const grnLine = grn.lines.find((l) => l.id === reqLine.goods_receipt_line_id);
      if (!grnLine) {
        throw new BadRequestException(
          `Goods Receipt Line ${reqLine.goods_receipt_line_id} does not belong to GRN ${grn.document_number}`
        );
      }

      const receivedQty = Number(grnLine.received_quantity);
      if (reqLine.quantity > receivedQty) {
        throw new BadRequestException(
          `Requested label quantity (${reqLine.quantity}) exceeds received quantity (${receivedQty}) for item ${grnLine.item.name}`
        );
      }

      const primary = grnLine.item.barcodes.find((b) => b.is_primary) || grnLine.item.barcodes[0];
      const barcode = primary ? primary.barcode : grnLine.item.sku;
      const barcodeType = primary ? primary.barcode_type : 'CODE128';

      labels.push({
        goods_receipt_line_id: grnLine.id,
        item_id: grnLine.item.id,
        item_name: grnLine.item.name,
        sku: grnLine.item.sku,
        barcode,
        barcode_type: barcodeType,
        batch_number: grnLine.batch_number || null,
        expiry_date: grnLine.expiry_date ? grnLine.expiry_date.toISOString().split('T')[0] : null,
        received_quantity: receivedQty,
        label_quantity: reqLine.quantity,
        grn_number: grn.document_number,
        supplier_name: grn.party?.name || 'Supplier',
      });
    }

    // Build unified printable representation
    const printableHtml = labels
      .map((l) =>
        this.generateHtmlLayout({
          title: l.item_name,
          sku: l.sku,
          barcode: l.barcode,
          barcodeType: l.barcode_type,
          batchNumber: l.batch_number,
          expiryDate: l.expiry_date,
          grnNumber: l.grn_number,
          widthMm: 50,
          heightMm: 25,
          quantity: l.label_quantity,
        })
      )
      .join('<div style="page-break-after: always;"></div>');

    // Audit log linking GRN lineage
    await this.prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: userId,
        action: 'INWARD_LABEL_PRINTED',
        source_document_type: 'GoodsReceipt',
        source_document_id: grn.id,
        details: JSON.stringify({
          grn_id: grn.id,
          document_number: grn.document_number,
          lines_count: labels.length,
          total_labels: labels.reduce((sum, l) => sum + l.label_quantity, 0),
        }),
      },
    });

    return {
      goods_receipt_id: grn.id,
      document_number: grn.document_number,
      labels,
      printable_html: printableHtml,
      total_labels_requested: labels.reduce((sum, l) => sum + l.label_quantity, 0),
    };
  }

  /**
   * Record a print / reprint execution.
   * STRICT INVARIANT: Audit only. Zero stock mutation, zero ledger entry.
   */
  async recordPrintJob(companyId: string, userId: string, dto: RecordPrintJobDto) {
    if (!dto.quantity || dto.quantity < 1) {
      throw new BadRequestException('Print quantity must be at least 1');
    }

    const audit = await this.prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: userId,
        action: 'LABEL_PRINTED',
        source_document_type: dto.document_type,
        source_document_id: dto.document_id,
        details: JSON.stringify({
          document_type: dto.document_type,
          document_id: dto.document_id,
          quantity: dto.quantity,
          notes: dto.notes || 'Label printed',
          reprint: true,
        }),
      },
    });

    return {
      success: true,
      audit_id: audit.id,
      document_id: dto.document_id,
      quantity_printed: dto.quantity,
    };
  }

  // ── Template Management ───────────────────────────────────────────────────

  async createTemplate(companyId: string, dto: CreateLabelTemplateDto) {
    if (dto.is_default) {
      await this.prisma.labelTemplate.updateMany({
        where: { company_id: companyId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.labelTemplate.create({
      data: {
        company_id: companyId,
        name: dto.name,
        template_type: dto.template_type || 'PRODUCT',
        paper_type: dto.paper_type || 'ROLL',
        width_mm: dto.width_mm,
        height_mm: dto.height_mm,
        columns: dto.columns || 1,
        is_default: dto.is_default || false,
        config_json: dto.config_json || null,
        is_active: true,
      },
    });
  }

  async getTemplates(companyId: string, type?: string) {
    const where: any = { company_id: companyId, is_active: true };
    if (type) where.template_type = type;

    return this.prisma.labelTemplate.findMany({
      where,
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    });
  }

  async getTemplateById(companyId: string, id: string) {
    const template = await this.prisma.labelTemplate.findUnique({
      where: { id },
    });
    if (!template || template.company_id !== companyId) {
      throw new NotFoundException('Label template not found');
    }
    return template;
  }

  async updateTemplate(companyId: string, id: string, dto: UpdateLabelTemplateDto) {
    const existing = await this.prisma.labelTemplate.findUnique({ where: { id } });
    if (!existing || existing.company_id !== companyId) {
      throw new NotFoundException('Label template not found');
    }

    if (dto.is_default) {
      await this.prisma.labelTemplate.updateMany({
        where: { company_id: companyId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.labelTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        template_type: dto.template_type,
        paper_type: dto.paper_type,
        width_mm: dto.width_mm,
        height_mm: dto.height_mm,
        columns: dto.columns,
        is_default: dto.is_default,
        is_active: dto.is_active,
        config_json: dto.config_json,
      },
    });
  }

  async deleteTemplate(companyId: string, id: string) {
    const existing = await this.prisma.labelTemplate.findUnique({ where: { id } });
    if (!existing || existing.company_id !== companyId) {
      throw new NotFoundException('Label template not found');
    }

    await this.prisma.labelTemplate.delete({ where: { id } });
    return { success: true };
  }

  // ── Payload Helpers ───────────────────────────────────────────────────────

  private generateHtmlLayout(params: {
    title: string;
    sku: string;
    barcode: string;
    barcodeType?: string;
    unit?: string;
    mrp?: number;
    saleRate?: number;
    batchNumber?: string | null;
    expiryDate?: string | null;
    grnNumber?: string;
    companyName?: string;
    widthMm: number;
    heightMm: number;
    quantity: number;
  }): string {
    const labelsHtml = Array.from({ length: params.quantity })
      .map(
        () => `
      <div class="label-item" style="width: ${params.widthMm}mm; height: ${params.heightMm}mm; box-sizing: border-box; padding: 2mm; border: 1px dashed #ccc; font-family: sans-serif; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid;">
        <div style="font-size: 10px; font-weight: bold; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${escapeHtml(params.title)}</div>
        <div style="text-align: center; margin: 1mm 0;">
          <div style="font-family: monospace; font-size: 14px; letter-spacing: 2px; font-weight: bold;">||| | |||| | |||||</div>
          <div style="font-size: 9px; font-family: monospace;">${escapeHtml(params.barcode)}</div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8px;">
          <span>SKU: ${escapeHtml(params.sku)}</span>
          ${params.mrp ? `<span>MRP: ₹${params.mrp.toFixed(2)}</span>` : ''}
        </div>
        ${
          params.batchNumber || params.expiryDate
            ? `<div style="display: flex; justify-content: space-between; font-size: 7px; color: #444;">
                ${params.batchNumber ? `<span>B: ${escapeHtml(params.batchNumber)}</span>` : ''}
                ${params.expiryDate ? `<span>EXP: ${escapeHtml(params.expiryDate)}</span>` : ''}
              </div>`
            : ''
        }
      </div>`
      )
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>Labels - ${escapeHtml(params.title)}</title>
<style>
  @media print {
    @page { size: ${params.widthMm}mm ${params.heightMm}mm; margin: 0; }
    body { margin: 0; padding: 0; }
    .label-item { border: none !important; }
  }
  .labels-container {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
  }
</style>
</head>
<body>
<div class="labels-container">
${labelsHtml}
</div>
</body>
</html>`;
  }

  private generateZplPayload(params: {
    title: string;
    sku: string;
    barcode: string;
    mrp?: number;
    saleRate?: number;
    quantity: number;
    widthMm: number;
    heightMm: number;
  }): string {
    const dotsWidth = Math.round(params.widthMm * 8); // 203 DPI is approx 8 dots/mm
    const dotsHeight = Math.round(params.heightMm * 8);

    return `^XA
^PW${dotsWidth}
^LL${dotsHeight}
^FO20,20^A0N,24,24^FD${params.title.slice(0, 30)}^FS
^FO20,55^BY2,3,50^BCN,50,Y,N,N^FD${params.barcode}^FS
^FO20,135^A0N,18,18^FDSKU: ${params.sku}^FS
${params.mrp ? `^FO200,135^A0N,18,18^FDMRP: ${params.mrp.toFixed(2)}^FS` : ''}
^PQ${params.quantity},0,1,Y
^XZ`;
  }

  private generateEscPosPayload(params: {
    title: string;
    barcode: string;
    mrp?: number;
    quantity: number;
  }): string {
    return [
      '\\x1B\\x40', // Initialize printer
      '\\x1B\\x61\\x01', // Center alignment
      `${params.title}\\n`,
      '\\x1D\\x6B\\x04', // Barcode CODE128 command
      `${params.barcode}\\x00`,
      `*${params.barcode}*\\n`,
      params.mrp ? `MRP: Rs.${params.mrp.toFixed(2)}\\n` : '',
      '\\x1D\\x56\\x41\\x00', // Cut paper
    ].join('');
  }
}
