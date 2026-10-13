import { Module } from '@nestjs/common';
import { RetailModule } from '../retail/retail.module';
import { ReportsModule } from '../retail/reports/reports.module';
import { BillingModule } from '../retail/billing/billing.module';
import { AssistantController,PlatformAssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantCatalogService } from './assistant-catalog.service';
import { EntityResolverService } from './entity-resolver.service';
import { AssistantToolRegistry } from './tool-registry.service';
import { AssistantAnalyticsService } from './assistant-analytics.service';
import { BusinessInsightService } from './business-insight.service';
import { EntitlementService } from '../common/entitlement.service';
@Module({imports:[RetailModule,ReportsModule,BillingModule],controllers:[AssistantController,PlatformAssistantController],providers:[AssistantService,AssistantCatalogService,EntityResolverService,AssistantToolRegistry,AssistantAnalyticsService,BusinessInsightService,EntitlementService]})
export class AssistantModule {}
