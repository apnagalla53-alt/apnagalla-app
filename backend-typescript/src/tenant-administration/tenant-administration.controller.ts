import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantAdministrationGuard } from './tenant-administration.guard';
import { TenantAdministrationService } from './tenant-administration.service';
import { AdminPasswordDto, BranchUpdateDto, CompanyUpdateDto, CreateBranchDto, CreateCompanyDto, CreateFinancialYearDto, CreateLocationDto, CreateStaffDto, DirectoryQuery, LocationUpdateDto, OrganizationUpdateDto, RoleDto, StaffUpdateDto } from './tenant-administration.dto';

@Controller('users') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class UsersController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listStaff(req.user, query); }
  @Get(':id') get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getStaff(req.user, id); }
  @Post() create(@Req() req: any, @Body() dto: CreateStaffDto) { return this.service.createStaff(req.user, dto); }
  @Patch(':id') update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StaffUpdateDto) { return this.service.updateStaff(req.user, id, dto); }
  // Identity is retained for historic vouchers/audit; this archives access instead of erasing history.
  @Delete(':id') archive(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.staffAction(req.user, id, 'delete'); }
  @Patch(':id/disable') disable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.staffAction(req.user, id, 'disable'); }
  @Patch(':id/enable') enable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.staffAction(req.user, id, 'enable'); }
  @Patch(':id/unlock') unlock(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.staffAction(req.user, id, 'unlock'); }
  @Patch(':id/reset-password') password(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminPasswordDto) { return this.service.staffAction(req.user, id, 'reset-password', dto); }
  @Post(':id/roles') role(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query('role_id', ParseUUIDPipe) roleId: string) { return this.service.assignRole(req.user, id, roleId); }
  @Delete(':id/roles/:roleId') removeRole(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('roleId', ParseUUIDPipe) roleId: string) { return this.service.assignRole(req.user, id, roleId, true); }
  @Get(':id/sessions') sessions(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query() query: DirectoryQuery) { return this.service.listSessions(req.user, { ...query, user_id: id }); }
  @Post(':id/sessions/revoke-all') revoke(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.revokeStaffSessions(req.user, id); }
}

@Controller('roles') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class RolesController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listRoles(req.user, query); }
  @Get(':id') get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getRole(req.user, id); }
  @Post() create(@Req() req: any, @Body() dto: RoleDto) { return this.service.createRole(req.user, dto); }
  @Patch(':id') update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RoleDto) { return this.service.updateRole(req.user, id, dto); }
  @Delete(':id') remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.deleteRole(req.user, id); }
  @Get(':id/users') users(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query() query: DirectoryQuery) { return this.service.roleUsers(req.user, id, query); }
  @Post(':id/permissions') permission(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query('permission_code') code: string) { return this.service.rolePermission(req.user, id, code); }
  @Delete(':id/permissions/:code') removePermission(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('code') code: string) { return this.service.rolePermission(req.user, id, code, true); }
}

@Controller('permissions') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class PermissionsController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Query() query: DirectoryQuery) { return this.service.listPermissions(query); }
}

@Controller('sessions') @UseGuards(AuthGuard)
export class SessionsController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listSessions(req.user, query); }
  @Post(':id/revoke') revoke(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.revokeSession(req.user, id); }
}

@Controller('organizations') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class OrganizationsController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listOrganizations(req.user, query); }
  @Get(':id') get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getOrganization(req.user, id); }
  @Patch(':id') update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrganizationUpdateDto) { return this.service.updateOrganization(req.user, id, dto); }
  @Post() create() { throw new ForbiddenException('Tenant creation requires explicit Platform Super Admin authorization'); }
  @Patch(':id/disable') disable() { throw new ForbiddenException('Tenant suspension requires explicit Platform Super Admin authorization'); }
  @Patch(':id/enable') enable() { throw new ForbiddenException('Tenant reactivation requires explicit Platform Super Admin authorization'); }
  @Delete(':id') delete() { throw new ForbiddenException('Tenant deletion is not available from shop administration'); }
}

@Controller('companies') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class CompaniesController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listCompanies(req.user, query); }
  @Get(':id') get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getCompany(req.user, id); }
  @Post() create(@Req() req: any, @Body() dto: CreateCompanyDto) { return this.service.createCompany(req.user, dto); }
  @Patch(':id') update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompanyUpdateDto) { return this.service.updateCompany(req.user, id, dto); }
  @Patch(':id/disable') disable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.companyStatus(req.user, id, false); }
  @Patch(':id/enable') enable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.companyStatus(req.user, id, true); }
  @Delete(':id') archive(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.companyStatus(req.user, id, false); }
}

@Controller('branches') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class BranchesController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listBranches(req.user, query); }
  @Get(':id') get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getBranch(req.user, id); }
  @Post() create(@Req() req: any, @Body() dto: CreateBranchDto) { return this.service.createBranch(req.user, dto); }
  @Patch(':id') update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BranchUpdateDto) { return this.service.updateBranch(req.user, id, dto); }
  @Patch(':id/disable') disable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.branchStatus(req.user, id, false); }
  @Patch(':id/enable') enable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.branchStatus(req.user, id, true); }
  @Delete(':id') archive(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.branchStatus(req.user, id, false); }
}

@Controller('godowns') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class GodownsController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listLocations(req.user, query); }
  @Get(':id') get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getLocation(req.user, id); }
  @Post() create(@Req() req: any, @Body() dto: CreateLocationDto) { return this.service.createLocation(req.user, dto); }
  @Patch(':id') update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LocationUpdateDto) { return this.service.updateLocation(req.user, id, dto); }
  @Patch(':id/disable') disable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.locationStatus(req.user, id, false); }
  @Patch(':id/enable') enable(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.locationStatus(req.user, id, true); }
  @Delete(':id') archive(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.locationStatus(req.user, id, false); }
}

@Controller('financial-years') @UseGuards(AuthGuard, TenantAdministrationGuard)
export class FinancialYearsController {
  constructor(private readonly service: TenantAdministrationService) {}
  @Get() list(@Req() req: any, @Query() query: DirectoryQuery) { return this.service.listFinancialYears(req.user, query); }
  @Get(':id') get(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.getFinancialYear(req.user, id); }
  @Post() create(@Req() req: any, @Body() dto: CreateFinancialYearDto) { return this.service.createFinancialYear(req.user, dto); }
  @Patch(':id/activate') activate(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.financialYearAction(req.user, id, false); }
  @Patch(':id/close') close(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) { return this.service.financialYearAction(req.user, id, true); }
}
