import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesController } from './categories/expense-categories.controller';
import { ExpenseCategoriesService } from './categories/expense-categories.service';
import { PrismaService } from '../../database/prisma.service';
import { AccountingModule } from '../../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [ExpensesService, ExpenseCategoriesService, PrismaService],
  exports: [ExpensesService, ExpenseCategoriesService],
})
export class ExpensesModule {}
