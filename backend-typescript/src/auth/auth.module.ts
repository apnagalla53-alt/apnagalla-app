import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../database/prisma.module';
import { AuthController, PlatformPasswordController } from './auth.controller';
import { AuthService } from './auth.service';
import { EntitlementService } from '../common/entitlement.service';
import { jwtSecret } from './jwt-secret';
import { AuthEmailService } from './auth-email.service';
import { GoogleIdentityService } from './google-identity.service';
import { GoogleAuthService } from './google-auth.service';
import { PasswordLifecycleService } from './password-lifecycle.service';
import { PlatformPasswordService } from './platform-password.service';
import { PlatformAuthGuard } from '../platform/auth/platform-auth.guard';
import { TenantProvisioningModule } from '../platform/provisioning/tenant-provisioning.module';
import { AccountPolicyService } from './account-policy.service';
import { SmsOtpProvider } from './sms-otp.provider';
import { MobileOtpService } from './mobile-otp.service';
import { ReferralService } from './referral.service';
import { OnboardingService } from './onboarding.service';
import { AccountSessionGuard } from './account-session.guard';
import { AccountController } from './account.controller';

@Global()
@Module({
  imports: [
    PrismaModule,
    TenantProvisioningModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: '1d' } }),
    }),
  ],
  controllers: [AuthController, PlatformPasswordController, AccountController],
  providers: [AuthService, EntitlementService, AuthEmailService, GoogleIdentityService, GoogleAuthService, PasswordLifecycleService, PlatformPasswordService, PlatformAuthGuard, AccountPolicyService, SmsOtpProvider, MobileOtpService, ReferralService, OnboardingService, AccountSessionGuard],
  exports: [AuthService, EntitlementService, AccountPolicyService, ReferralService, AuthEmailService],
})
export class AuthModule {}
