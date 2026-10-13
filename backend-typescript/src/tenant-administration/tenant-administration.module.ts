import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { TenantAdministrationService } from './tenant-administration.service';
import { TenantAdministrationGuard } from './tenant-administration.guard';
import { BranchesController, CompaniesController, FinancialYearsController, GodownsController, OrganizationsController, PermissionsController, RolesController, SessionsController, UsersController } from './tenant-administration.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, RolesController, PermissionsController, SessionsController, OrganizationsController, CompaniesController, BranchesController, GodownsController, FinancialYearsController],
  providers: [TenantAdministrationService, TenantAdministrationGuard],
  exports: [TenantAdministrationService],
})
export class TenantAdministrationModule {}
