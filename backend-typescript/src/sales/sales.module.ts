import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesPostingService } from './posting.service';
import { SalesConversionService } from './conversion.service';
import { PrismaModule } from '../database/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountingModule } from '../accounting/accounting.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PrismaModule, InventoryModule, AccountingModule, PricingModule],
  controllers: [SalesController],
  providers: [SalesService, SalesPostingService, SalesConversionService],
  exports: [SalesService, SalesPostingService, SalesConversionService],
})
export class SalesModule {}
