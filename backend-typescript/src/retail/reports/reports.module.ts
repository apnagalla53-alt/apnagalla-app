import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportAssistantController } from './report-assistant.controller';
import { ReportAssistantService } from './report-assistant.service';
import { CounterService } from '../counter/counter.service';
import { EntitlementService } from '../../common/entitlement.service';
import { OperationalReportsService } from './operational-reports.service';
import { FinancialReportsController } from './financial-reports.controller';
import { FinancialReportsService } from './financial-reports.service';
import { AccountingModule } from '../../accounting/accounting.module';

@Module({
  imports:[AccountingModule],
  controllers: [ReportsController,ReportAssistantController,FinancialReportsController],
  providers: [ReportsService,ReportAssistantService,CounterService,EntitlementService,OperationalReportsService,FinancialReportsService],
  exports: [ReportsService,ReportAssistantService,OperationalReportsService,FinancialReportsService],
})
export class ReportsModule {}
