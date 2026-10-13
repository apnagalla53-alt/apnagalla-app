import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PostingService } from './posting.service';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { CreditService } from './credit.service';
import { BankingService } from './banking.service';
import { BankingController } from './banking.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AccountingController, BankingController],
  providers: [PostingService, AccountingService, CreditService, BankingService],
  exports: [PostingService, AccountingService, CreditService, BankingService],
})
export class AccountingModule {}
