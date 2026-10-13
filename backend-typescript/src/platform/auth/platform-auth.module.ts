import { Module } from '@nestjs/common';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { jwtSecret } from '../../auth/jwt-secret';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformMfaService } from './platform-mfa.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: jwtSecret(true),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    })
  ],
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformAuthGuard,PlatformMfaService],
  exports: [PlatformAuthService, PlatformAuthGuard, JwtModule]
})
export class PlatformAuthModule {}
