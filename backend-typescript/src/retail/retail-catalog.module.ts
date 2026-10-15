import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseModule } from '../purchase/purchase.module';
import { RetailService } from './retail.service';
@Module({imports:[AccountingModule,InventoryModule,PurchaseModule],providers:[RetailService],exports:[RetailService]})
export class RetailCatalogModule {}
