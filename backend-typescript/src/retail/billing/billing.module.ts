import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PosModule } from '../../pos/pos.module';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [PosModule],
  controllers: [BillingController],
  providers: [BillingService, PrismaService],
  exports:[BillingService],
})
export class BillingModule {}
