import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PosModule } from '../../pos/pos.module';
import { PrismaService } from '../../database/prisma.service';
import { RetailCatalogModule } from '../retail-catalog.module';
import { EntitlementService } from '../../common/entitlement.service';

@Module({
  imports: [PosModule,RetailCatalogModule],
  controllers: [BillingController],
  providers: [BillingService, PrismaService,EntitlementService],
  exports:[BillingService],
})
export class BillingModule {}
