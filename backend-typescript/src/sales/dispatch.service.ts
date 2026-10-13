import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatches a Delivery Challan.
   */
  async dispatchChallan(challanId: string, companyId: string, trackingNumber?: string, vehicleNumber?: string) {
    const challan = await this.prisma.deliveryChallan.findUnique({
      where: { id: challanId }
    });

    if (!challan || challan.company_id !== companyId) {
      throw new NotFoundException('Delivery Challan not found');
    }

    if (challan.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot dispatch a challan that is in ${challan.status} state`);
    }

    // In a real scenario, we might track vehicle and tracking number in an extension table
    // or JSON metadata field. For this mock, we just update the status.
    return this.prisma.deliveryChallan.update({
      where: { id: challanId },
      data: {
        status: 'DISPATCHED',
        posted_at: new Date()
      }
    });
  }

  /**
   * Records Proof of Delivery (POD)
   */
  async recordProofOfDelivery(challanId: string, companyId: string, receiverName: string, notes?: string) {
    const challan = await this.prisma.deliveryChallan.findUnique({
      where: { id: challanId }
    });

    if (!challan || challan.company_id !== companyId) {
      throw new NotFoundException('Delivery Challan not found');
    }

    if (challan.status !== 'DISPATCHED') {
      throw new BadRequestException('Can only record POD for dispatched challans');
    }

    // Since DELIVERED is not strictly defined in the Prisma schema comment but may be allowed
    // by the database (usually varchar 50), we can update it. If the DB restricts it, we use DISPATCHED.
    // The string is just a comment `// 'DRAFT', 'DISPATCHED', 'CANCELLED'` in Prisma, not an enum!
    return this.prisma.deliveryChallan.update({
      where: { id: challanId },
      data: {
        status: 'DELIVERED',
        // In a real implementation we would save receiverName and POD image to a `delivery_proofs` table
      }
    });
  }
}
