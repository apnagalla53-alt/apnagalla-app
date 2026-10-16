import { RetailAuditController } from './audit.controller';
import { AttachmentsModule } from '../attachments/attachments.module';
import { RetailIntakeController } from './intake/intake.controller';
import { RetailIntakeService } from './intake/intake.service';
import { Module } from '@nestjs/common';
import { RetailImportController } from './imports/import.controller';
import { RetailImportService } from './imports/import.service';
import { OpeningStockService } from '../inventory/opening-stock.service';
import { RetailCalendarController } from './calendar/calendar.controller';
import { RetailAccountController } from './account/account.controller';
import { RetailExportController } from './account/export.controller';
import { EntitlementService } from '../common/entitlement.service';
import { CounterController } from './counter/counter.controller';
import { CounterService } from './counter/counter.service';
import { RetailController } from './retail.controller';
import { RetailService } from './retail.service';
import { RetailCatalogModule } from './retail-catalog.module';
import { ItemRemovalService } from './item-removal.service';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaService } from '../database/prisma.service';
import { ExpensesModule } from './expenses/expenses.module';
import { BillingModule } from './billing/billing.module';
import { ReportsModule } from './reports/reports.module';
import { PurchaseModule } from '../purchase/purchase.module';
import { RetailGstController } from './gst/gst.controller';
import { RetailGstService } from './gst/gst.service';
import { RetailNotificationsController } from './account/notifications.controller';
import { ItemCompositionModule } from '../item-composition/item-composition.module';
import { RetailExperienceController } from './experience/retail-experience.controller';
import { RetailExperienceService } from './experience/retail-experience.service';

@Module({
  imports: [RetailCatalogModule,AttachmentsModule,AccountingModule, InventoryModule, PurchaseModule, ExpensesModule, BillingModule, ReportsModule,ItemCompositionModule],
  controllers: [RetailAuditController,RetailIntakeController,RetailController, CounterController, RetailAccountController, RetailExportController, RetailCalendarController, RetailImportController, RetailGstController, RetailNotificationsController, RetailExperienceController],
  providers: [RetailIntakeService, ItemRemovalService, PrismaService, CounterService, EntitlementService, RetailImportService, OpeningStockService, RetailGstService, RetailExperienceService],
  exports:[RetailCatalogModule,CounterService],
})
export class RetailModule {}
