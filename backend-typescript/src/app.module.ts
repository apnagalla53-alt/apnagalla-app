import { BusinessEditAuditInterceptor } from './common/business-edit-audit.interceptor';
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TenantAdministrationModule } from './tenant-administration/tenant-administration.module';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { PurchaseModule } from './purchase/purchase.module';
// Modules that will be added later
// import { AuthModule } from './auth/auth.module';
// import { IdentityModule } from './identity/identity.module';
// import { OrganizationModule } from './organization/organization.module';

import { IntelligenceModule } from './intelligence/intelligence.module';
import { AccountingModule } from './accounting/accounting.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { PlatformModule } from './platform/platform.module';
import { PosModule } from './pos/pos.module';
import { ClaimsModule } from './claims/claims.module';
import { BarcodeModule } from './barcode/barcode.module';
import { PricingModule } from './pricing/pricing.module';
import { RetailModule } from './retail/retail.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { SafeHttpErrorFilter } from './common/http-error.filter';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';
import { validateEnvironment } from './common/environment';
import { AssistantModule } from './assistant/assistant.module';
import { BrowserSessionInterceptor } from './auth/browser-session.interceptor';
import { SecurityRateModule } from './common/security-rate.module';
import { SecurityContextMiddleware } from './database/security-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    PrismaModule,
    SecurityRateModule,
    HealthModule,
    AccountingModule,
    InventoryModule,
    AuthModule,
    TenantAdministrationModule,
    PlatformModule,
    PosModule,
    PricingModule,
    RetailModule,
    AssistantModule,
    SalesModule,
    AttachmentsModule,
    PurchaseModule,
    ClaimsModule,
    BarcodeModule,
  ],
  controllers: [AppController],
  providers: [AppService, {provide:APP_INTERCEPTOR,useClass:BrowserSessionInterceptor}, { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },{provide:APP_INTERCEPTOR,useClass:BusinessEditAuditInterceptor},{provide:APP_FILTER,useClass:SafeHttpErrorFilter}],
})
export class AppModule implements NestModule{
 configure(consumer:MiddlewareConsumer){consumer.apply(SecurityContextMiddleware).forRoutes({path:'{*path}',method:RequestMethod.ALL});}
}
