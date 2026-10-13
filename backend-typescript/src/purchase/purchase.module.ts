import { Module } from '@nestjs/common';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';
import { PostingService } from './posting.service';
import { PurchaseConversionService } from './conversion.service';
import { PrismaModule } from '../database/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PrismaModule, AccountingModule, InventoryModule],
  controllers: [PurchaseController],
  providers: [PurchaseService, PostingService, PurchaseConversionService],
  exports: [PurchaseService, PostingService, PurchaseConversionService],
})
export class PurchaseModule {}
