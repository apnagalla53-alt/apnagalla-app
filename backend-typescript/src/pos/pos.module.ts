import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountingModule } from '../accounting/accounting.module';
import { PrismaModule } from '../database/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { ItemCompositionModule } from '../item-composition/item-composition.module';

@Module({
  imports: [PrismaModule, InventoryModule, AccountingModule, PricingModule, ItemCompositionModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService]
})
export class PosModule {}
