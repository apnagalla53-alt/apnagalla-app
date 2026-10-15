import { Module } from '@nestjs/common';
import { PublicAppController, PlatformPublishingController } from './publishing.controller';
import { PlatformAdminController } from './tenants/platform-admin.controller';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { TenantProvisioningModule } from './provisioning/tenant-provisioning.module';
import { ConfigModule } from '@nestjs/config';
import { PlatformService } from './platform.service';
import { BackupProvider, PlatformBackupService } from './backup.service';
import { ControlPlaneController, OwnerReferralController } from './control-plane.controller';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantCredentialsService } from './tenant-credentials.service';
import { AttachmentsModule } from '../attachments/attachments.module';
import { TenantUserLifecycleService } from './tenant-user-lifecycle.service';
import { ActivationCampaignController } from './activation-campaign.controller';

@Module({
  imports: [
    PlatformAuthModule,
    TenantProvisioningModule,
    ConfigModule,
    AttachmentsModule
  ],
  controllers: [PlatformAdminController, PublicAppController, PlatformPublishingController, ControlPlaneController, OwnerReferralController, ActivationCampaignController],
  providers: [PlatformService, BackupProvider, PlatformBackupService, TenantLifecycleService, TenantCredentialsService, TenantUserLifecycleService],
})
export class PlatformModule {}
