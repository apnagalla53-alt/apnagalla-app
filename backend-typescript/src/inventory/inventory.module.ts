import { Module } from '@nestjs/common';
import { InventoryPostingService } from './posting.service';
import { StockAdjustmentService } from './adjustment.service';
import { StockTransferService } from './transfer.service';
import { OpeningStockService } from './opening-stock.service';
import { StockCountService } from './stock-count.service';
import { InventoryController } from './inventory.controller';
import { PrismaModule } from '../database/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { BatchExpiryService } from './batch-expiry.service';

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [InventoryController],
  providers: [InventoryPostingService, StockAdjustmentService, StockTransferService, OpeningStockService, StockCountService, BatchExpiryService],
  exports: [InventoryPostingService, StockAdjustmentService, StockTransferService, OpeningStockService, StockCountService, BatchExpiryService],
})
export class InventoryModule {}
