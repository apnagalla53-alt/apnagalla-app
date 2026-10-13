import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PricingEngineService } from './pricing-engine.service';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PricingController],
  providers: [PricingEngineService, PricingService],
  exports: [PricingEngineService, PricingService],
})
export class PricingModule {}
