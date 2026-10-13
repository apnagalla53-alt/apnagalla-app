import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/expense.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import {FeatureGuard,RequireFeature} from '../../common/guards/feature.guard';

@Controller('retail/expenses')
@UseGuards(AuthGuard,FeatureGuard)
@RequireFeature('EXPENSES')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  async create(@Req() req: any, @Body() createExpenseDto: CreateExpenseDto) {
    if (createExpenseDto.type === 'BUSINESS_EXPENSE' && !createExpenseDto.category_id) {
      throw new BadRequestException('category_id is required for BUSINESS_EXPENSE');
    }
    
    const financialYearId = req.headers['x-financial-year-id'];
    
    return this.expensesService.create(
      req.user.organization_id,
      req.user.company_id,
      req.user.branch_id,
      req.user.id,
      financialYearId,
      createExpenseDto
    );
  }

  @Get()
  async findAll(@Req() req: any, @Query() query: any) {
    return this.expensesService.findAll(req.user.company_id, req.user.branch_id, query);
  }

  @Get('summary')
  async getSummary(@Req() req: any) {
    return this.expensesService.getSummary(req.user.company_id, req.user.branch_id);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.findOne(req.user.company_id, id);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() updateExpenseDto: CreateExpenseDto) {
    if (updateExpenseDto.type === 'BUSINESS_EXPENSE' && !updateExpenseDto.category_id) {
      throw new BadRequestException('category_id is required for BUSINESS_EXPENSE');
    }
    const financialYearId = req.headers['x-financial-year-id'];
    return this.expensesService.update(
      req.user.organization_id,
      req.user.company_id,
      req.user.branch_id,
      req.user.id,
      financialYearId,
      id,
      updateExpenseDto
    );
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.expensesService.cancel(req.user.company_id, req.user.id, id);
  }
}
