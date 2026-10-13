import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface MobileOrderSyncPayload {
  mobile_reference_id: string;
  party_id: string;
  document_date: Date;
  lines: {
    item_id: string;
    unit_id: string;
    quantity: number;
    rate: number;
  }[];
}

@Injectable()
export class FieldSalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the beat plan (assigned parties) for a field sales executive.
   * Mock implementation: returns all parties in the company for this executive.
   */
  async getAssignedBeat(companyId: string, userId: string) {
    // In a real implementation, this would query a Beat routing table
    // For now, we mock it by returning all parties belonging to the company.
    const parties = await this.prisma.party.findMany({
      where: { company_id: companyId, party_type: 'CUSTOMER' },
      select: { id: true, name: true, code: true }
    });

    return {
      beat_name: 'Daily Default Route',
      parties
    };
  }

  /**
   * Syncs offline orders collected by the mobile app to the central ERP.
   */
  async syncMobileOrders(companyId: string, branchId: string, userId: string, orders: MobileOrderSyncPayload[]) {
    const results = [];

    // Process each order. If one fails, the others can still succeed.
    for (const orderData of orders) {
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          
          let total = new Prisma.Decimal(0);
          const linesData = orderData.lines.map(line => {
            const lineTotal = new Prisma.Decimal(line.quantity).mul(line.rate);
            total = total.add(lineTotal);
            
            return {
              item_id: line.item_id,
              unit_id: line.unit_id,
              ordered_quantity: line.quantity,
              rate: line.rate,
              line_total: lineTotal
            };
          });

          return tx.salesOrder.create({
            data: {
              company_id: companyId,
              branch_id: branchId,
              party_id: orderData.party_id,
              document_number: `MOB-${orderData.mobile_reference_id}`, // Mock prefix for mobile orders
              document_date: new Date(orderData.document_date),
              status: 'CONFIRMED', // Mobile orders skip draft state often
              total: total,
              notes: 'Created via Mobile App Sync',
              lines: {
                create: linesData
              }
            }
          });
        });

        results.push({
          mobile_reference_id: orderData.mobile_reference_id,
          success: true,
          erp_sales_order_id: order.id,
          document_number: order.document_number
        });
      } catch (error: any) {
        results.push({
          mobile_reference_id: orderData.mobile_reference_id,
          success: false,
          error: error.message || 'Unknown error during order sync'
        });
      }
    }

    return results;
  }
}
