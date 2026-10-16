import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PosModule } from '../../pos/pos.module';
import { PrismaService } from '../../database/prisma.service';
import { RetailCatalogModule } from '../retail-catalog.module';
import { EntitlementService } from '../../common/entitlement.service';
import { BillCorrectionService } from './bill-correction.service';
import { InventoryModule } from '../../inventory/inventory.module';
import { AccountingModule } from '../../accounting/accounting.module';

@Module({
  imports: [PosModule,RetailCatalogModule,InventoryModule,AccountingModule],
  controllers: [BillingController],
  providers: [BillingService, BillCorrectionService, PrismaService,EntitlementService],
  exports:[BillingService],
})
export class BillingModule {}
