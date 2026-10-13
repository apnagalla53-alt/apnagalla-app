import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto, UpdateExpenseCategoryDto } from '../dto/expense.dto';
import { AuthGuard, RequirePermissions } from '../../../common/guards/auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import {FeatureGuard,RequireFeature} from '../../../common/guards/feature.guard';

@Controller('retail/expense-categories')
@UseGuards(AuthGuard,FeatureGuard)
@RequireFeature('EXPENSES')
export class ExpenseCategoriesController {
  constructor(private readonly expenseCategoriesService: ExpenseCategoriesService) {}

  @Post('initialize-defaults')
  @UseGuards(PermissionGuard)
  @RequirePermissions('accounting.write')
  async initializeDefaults(@Req() req: any) {
    return this.expenseCategoriesService.initializeDefaults(req.user.organization_id, req.user.company_id, req.user.branch_id);
  }

  @Post()
  async create(@Req() req: any, @Body() createDto: CreateExpenseCategoryDto) {
    return this.expenseCategoriesService.create(
      req.user.organization_id,
      req.user.company_id,
      req.user.branch_id,
      createDto
    );
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.expenseCategoriesService.findAll(req.user.company_id);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() updateDto: UpdateExpenseCategoryDto) {
    return this.expenseCategoriesService.update(req.user.company_id, id, updateDto);
  }
}
