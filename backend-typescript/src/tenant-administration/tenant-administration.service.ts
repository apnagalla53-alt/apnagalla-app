import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../common/entitlement.service';
import { validatePassword } from '../auth/password-policy';
import { isTenantAdministrator } from './tenant-administration.guard';
import { AdminPasswordDto, BranchUpdateDto, CompanyUpdateDto, CreateBranchDto, CreateCompanyDto, CreateFinancialYearDto, CreateLocationDto, CreateStaffDto, DirectoryQuery, LocationUpdateDto, OrganizationUpdateDto, RoleDto, StaffUpdateDto } from './tenant-administration.dto';

const owners = ['ADMIN', 'OWNER', 'TENANT_ADMIN'];
const protectedRole = (role: any) => role.system_role || owners.includes(role.name) || role.name.startsWith('BUSINESS_ADMIN_');
const staffInclude = { roles: { include: { role: true } } };
const roleInclude = { role_permissions: { include: { permission: true } } };

@Injectable()
export class TenantAdministrationService {
  constructor(private readonly db: PrismaService, private readonly entitlements: EntitlementService) {}

  private async atomic<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    try { return await this.db.$transaction(fn, { timeout: 15000 }); }
    catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('This code or username is already in use');
      if (error?.code === 'P2034') throw new ConflictException('This record changed. Please reload and try again');
      throw error;
    }
  }
  private async lock(tx: any, key: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`; }
  private async audit(tx: any, user: any, action: string, id?: string) {
    await tx.auditLog.create({ data: { company_id: user.company_id, branch_id: user.branch_id || undefined, user_id: user.id, action,
      source_document_type: 'TenantAdministration', source_document_id: id } });
  }
  private paging(query: DirectoryQuery) { return { take: query.limit || 100, skip: query.offset || 0 }; }
  private safeStaff(user: any, companyId: string) {
    return { id: user.id, username: user.username, display_name: user.display_name, email: user.email, phone: user.phone,
      language: user.language, is_active: user.is_active, is_locked: user.is_locked, last_active_at: user.last_active_at,
      roles: user.roles.filter((membership: any) => membership.company_id === companyId).map((membership: any) => ({ id: membership.role.id, name: membership.role.name, branch_id: membership.branch_id })) };
  }
  private staffScope(user: any) { return { organization_id: user.organization_id, OR: [{ roles: { some: { company_id: user.company_id } } }, { roles: { none: {} } }] }; }
  private async staff(user: any, id: string, tx: any = this.db) {
    const staff = await tx.user.findFirst({ where: { id, ...this.staffScope(user) }, include: staffInclude });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }
  private assertMutableStaff(user: any, staff: any) {
    if (staff.id === user.id) throw new ConflictException('Use your own account security settings for this action');
    if (staff.roles.some((membership: any) => membership.company_id !== user.company_id)) throw new ConflictException('This account belongs to several businesses. Use Platform account administration');
    if (staff.roles.some((membership: any) => protectedRole(membership.role))) throw new ConflictException('Owner accounts require Platform administration');
  }
  private assertPassword(password: string) {
    validatePassword(password);
  }
  private roleScope(user: any) {
    return { OR: [{ organization_id: user.organization_id }, { organization_id: null, user_roles: { some: { company_id: user.company_id, user: { organization_id: user.organization_id } } } }] };
  }
  private async role(user: any, id: string, tx: any = this.db) {
    const role = await tx.role.findFirst({ where: { id, ...this.roleScope(user) }, include: roleInclude });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
  private safeRole(role: any) { return { id: role.id, name: role.name, description: role.description, is_system: protectedRole(role), permissions: role.role_permissions.map((entry: any) => ({ id: entry.permission.id, code: entry.permission.code })) }; }
  private async assertMutableRole(user: any, role: any, tx: any) {
    if (protectedRole(role) || role.organization_id !== user.organization_id) throw new ForbiddenException('System and owner roles cannot be edited');
    if (await tx.userRole.count({ where: { role_id: role.id, company_id: { not: user.company_id } } })) throw new ConflictException('This role is shared by several businesses. Create a separate role before changing its permissions');
  }
  private assertRoleName(name: string) {
    if (owners.includes(name.toUpperCase()) || name.toUpperCase().startsWith('BUSINESS_ADMIN_') || name.toUpperCase().includes('SUPER_ADMIN')) throw new BadRequestException('This role name is reserved');
  }
  private async company(user: any, id: string, tx: any = this.db) {
    // A user may see only businesses in which they have an actual persisted membership.
    const membership = await tx.userRole.findFirst({ where: { user_id: user.id, company_id: id } });
    const company = membership && await tx.company.findFirst({ where: { id, organization_id: user.organization_id } });
    if (!company) throw new NotFoundException('Business not found');
    return company;
  }
  private async branch(user: any, id: string, tx: any = this.db) {
    const branch = await tx.branch.findFirst({ where: { id, company_id: user.company_id } });
    if (!branch) throw new NotFoundException('Store not found');
    return branch;
  }
  private async location(user: any, id: string, tx: any = this.db) {
    const location = await tx.godown.findFirst({ where: { id, branch: { company_id: user.company_id } } });
    if (!location) throw new NotFoundException('Stock location not found');
    return location;
  }
  private async requireMultipleLocations(user: any, tx: any = this.db) {
    return this.entitlements.require(user.organization_id,['MULTIPLE_STOCK_LOCATIONS'],user.company_id,tx);
  }

  async listStaff(user: any, query: DirectoryQuery) {
    const where: any = this.staffScope(user);
    if (query.q) where.AND = { OR: ['username', 'display_name', 'email', 'phone'].map(field => ({ [field]: { contains: query.q, mode: 'insensitive' } })) };
    return (await this.db.user.findMany({ where, include: staffInclude, orderBy: [{ display_name: 'asc' }, { id: 'asc' }], ...this.paging(query) })).map(staff => this.safeStaff(staff, user.company_id));
  }
  async getStaff(user: any, id: string) { return this.safeStaff(await this.staff(user, id), user.company_id); }
  async createStaff(user: any, dto: CreateStaffDto) {
    this.assertPassword(dto.password);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.atomic(async tx => {
      await this.lock(tx, 'staff:' + user.organization_id);
      const effective = await this.entitlements.resolve(user.organization_id, tx);
      await this.entitlements.require(user.organization_id,['STAFF'],user.company_id,tx);
      const staffLimit=Number((effective.limits as any).staff);
      const activeStaff=await tx.user.count({where:{organization_id:user.organization_id,is_active:true,roles:{some:{role:{name:{notIn:owners}}}}}});
      if(Number.isFinite(staffLimit)&&activeStaff>=staffLimit)throw new ForbiddenException('Your subscription staff limit has been reached');
      const userLimit = Number((effective.limits as any).users);
      if (Number.isFinite(userLimit) && userLimit > 0 && await tx.user.count({ where: { organization_id: user.organization_id, is_active: true } }) >= userLimit) throw new ForbiddenException('Your subscription staff limit has been reached');
      const roles = [];
      for (const id of dto.roles || []) {
        await this.entitlements.require(user.organization_id,['ADVANCED_STAFF'],user.company_id,tx);
        const role = await this.role(user, id, tx);
        if (protectedRole(role)) throw new ForbiddenException('New staff cannot be assigned an owner role');
        roles.push(role);
      }
      if (!roles.length) {
        let role = await tx.role.findFirst({ where: { organization_id: user.organization_id, name: 'STAFF' } });
        if (!role) {
          role = await tx.role.create({ data: { organization_id: user.organization_id, name: 'STAFF', description: 'Counter staff; billing and item lookup' } });
          for (const code of ['sales.read', 'sales.write', 'inventory.read', 'accounting.read', 'pos.sale.create', 'pos.shift.read', 'pos.shift.open', 'pos.shift.close']) {
            const permission = await tx.permission.upsert({ where: { code }, update: {}, create: { code, module: 'CORE', resource: 'ALL', action: code.split('.').pop()! } });
            await tx.rolePermission.create({ data: { role_id: role.id, permission_id: permission.id } });
          }
        }
        roles.push(role);
      }
      const staff = await tx.user.create({ data: { organization_id: user.organization_id, username: dto.username.trim(), display_name: dto.display_name.trim(),
        email: dto.email || null, phone: dto.phone || null, password_hash: passwordHash, must_change_password: true,
        temporary_password_expires_at: new Date(Date.now() + 24 * 3600_000), password_changed_at: new Date(),
        roles: { create: roles.map(role => ({ role_id: role.id, company_id: user.company_id, branch_id: user.branch_id || null })) } }, include: staffInclude });
      await this.audit(tx, user, 'STAFF_CREATE', staff.id);
      return this.safeStaff(staff, user.company_id);
    });
  }
  async updateStaff(user: any, id: string, dto: StaffUpdateDto) {
    return this.atomic(async tx => {
      const staff = await this.staff(user, id, tx);
      this.assertMutableStaff(user, staff);
      const emailChanged = dto.email !== undefined && dto.email !== staff.email;
      const updated = await tx.user.update({ where: { id }, data: { ...dto, ...(emailChanged ? { email_verified_at: null } : {}) }, include: staffInclude });
      if (emailChanged) await tx.authToken.updateMany({ where: { user_id: id, used_at: null }, data: { used_at: new Date() } });
      await this.audit(tx, user, 'STAFF_UPDATE', id);
      return this.safeStaff(updated, user.company_id);
    });
  }
  async staffAction(user: any, id: string, action: string, dto?: AdminPasswordDto) {
    const passwordHash = action === 'reset-password' && dto ? (this.assertPassword(dto.new_password), await bcrypt.hash(dto.new_password, 12)) : undefined;
    return this.atomic(async tx => {
      await this.lock(tx, 'staff:' + user.organization_id);
      const staff = await this.staff(user, id, tx);
      this.assertMutableStaff(user, staff);
      if (action === 'reset-password' && dto) {
        const history = await tx.passwordHistory.findMany({ where: { user_id: id }, orderBy: { created_at: 'desc' }, take: 5 });
        for (const hash of [staff.password_hash, ...history.map((entry: any) => entry.password_hash)]) if (await bcrypt.compare(dto.new_password, hash)) throw new BadRequestException('Choose a password that has not been used recently');
      }
      if(action==='enable'&&!staff.is_active){
        const effective=await this.entitlements.require(user.organization_id,['STAFF'],user.company_id,tx);
        const limit=Number((effective.limits as any).staff),users=Number((effective.limits as any).users);
        if(Number.isFinite(limit)&&await tx.user.count({where:{organization_id:user.organization_id,is_active:true,roles:{some:{role:{name:{notIn:owners}}}}}})>=limit)throw new ForbiddenException('Your subscription staff limit has been reached');
        if(Number.isFinite(users)&&await tx.user.count({where:{organization_id:user.organization_id,is_active:true}})>=users)throw new ForbiddenException('Your subscription user limit has been reached');
      }
      const data: any = action === 'enable' ? { is_active: true } : action === 'unlock' ? { is_locked: false, failed_login_count: 0 } : action === 'reset-password' ? { password_hash: passwordHash, is_locked: false, failed_login_count: 0,
        must_change_password: true, temporary_password_expires_at: new Date(Date.now() + 24 * 3600_000), password_changed_at: new Date() } : { is_active: false };
      if (action === 'reset-password') await tx.passwordHistory.create({ data: { user_id: id, password_hash: staff.password_hash } });
      await tx.user.update({ where: { id }, data });
      if (['disable', 'delete', 'reset-password'].includes(action)) await tx.session.updateMany({ where: { user_id: id, revoked_at: null }, data: { revoked_at: new Date() } });
      if (['disable', 'delete', 'reset-password'].includes(action)) await tx.authToken.updateMany({ where: { user_id: id, used_at: null }, data: { used_at: new Date() } });
      await this.audit(tx, user, 'STAFF_' + action.replace(/-/g, '_').toUpperCase(), id);
      return { success: true, retained_for_history: action === 'delete' };
    });
  }
  async assignRole(user: any, id: string, roleId: string, remove = false) {
    if(!remove)await this.entitlements.require(user.organization_id,['ADVANCED_STAFF'],user.company_id);
    return this.atomic(async tx => {
      await this.lock(tx, 'staff:' + user.organization_id);
      const staff = await this.staff(user, id, tx); this.assertMutableStaff(user, staff);
      const role = await this.role(user, roleId, tx);
      if (protectedRole(role)) throw new ForbiddenException('Owner roles require Platform administration');
      if (remove) await tx.userRole.deleteMany({ where: { user_id: id, role_id: roleId, company_id: user.company_id } });
      else {
        const existing = await tx.userRole.findUnique({ where: { user_id_role_id: { user_id: id, role_id: roleId } } });
        if (existing && existing.company_id !== user.company_id) throw new ConflictException('This role is assigned in another business');
        await tx.userRole.upsert({ where: { user_id_role_id: { user_id: id, role_id: roleId } }, update: {}, create: { user_id: id, role_id: roleId, company_id: user.company_id, branch_id: user.branch_id || null } });
      }
      await tx.session.updateMany({ where: { user_id: id, revoked_at: null }, data: { revoked_at: new Date() } });
      await this.audit(tx, user, remove ? 'STAFF_ROLE_REMOVE' : 'STAFF_ROLE_ASSIGN', id);
      return this.safeStaff(await this.staff(user, id, tx), user.company_id);
    });
  }
  async listRoles(user: any, query: DirectoryQuery) { return (await this.db.role.findMany({ where: this.roleScope(user), include: roleInclude, orderBy: { name: 'asc' }, ...this.paging(query) })).map(role => this.safeRole(role)); }
  async getRole(user: any, id: string) { return this.safeRole(await this.role(user, id)); }
  async roleUsers(user: any, id: string, query: DirectoryQuery) {
    await this.role(user, id);
    return (await this.db.user.findMany({ where: { organization_id: user.organization_id, roles: { some: { role_id: id, company_id: user.company_id } } }, include: staffInclude, ...this.paging(query) })).map(staff => this.safeStaff(staff, user.company_id));
  }
  async listPermissions(query: DirectoryQuery) { return this.db.permission.findMany({ select: { id: true, code: true, description: true }, orderBy: { code: 'asc' }, ...this.paging(query) }); }
  async createRole(user: any, dto: RoleDto) {
    await this.entitlements.require(user.organization_id,['ADVANCED_STAFF'],user.company_id);
    this.assertRoleName(dto.name.trim());
    return this.atomic(async tx => {
      const role = await tx.role.create({ data: { organization_id: user.organization_id, name: dto.name.trim(), description: dto.description }, include: roleInclude });
      await this.audit(tx, user, 'ROLE_CREATE', role.id); return this.safeRole(role);
    });
  }
  async updateRole(user: any, id: string, dto: RoleDto) {
    await this.entitlements.require(user.organization_id,['ADVANCED_STAFF'],user.company_id);
    this.assertRoleName(dto.name.trim());
    return this.atomic(async tx => {
      const role = await this.role(user, id, tx);
      await this.assertMutableRole(user, role, tx);
      const updated = await tx.role.update({ where: { id }, data: { name: dto.name.trim(), description: dto.description }, include: roleInclude });
      await this.audit(tx, user, 'ROLE_UPDATE', id); return this.safeRole(updated);
    });
  }
  async deleteRole(user: any, id: string) {
    return this.atomic(async tx => {
      const role = await this.role(user, id, tx);
      await this.assertMutableRole(user, role, tx);
      if (await tx.userRole.count({ where: { role_id: id } })) throw new ConflictException('Remove all staff assignments before deleting this role');
      await tx.role.delete({ where: { id } }); await this.audit(tx, user, 'ROLE_DELETE', id); return { success: true };
    });
  }
  async rolePermission(user: any, id: string, code: string, remove = false) {
    await this.entitlements.require(user.organization_id,['ADVANCED_STAFF'],user.company_id);
    return this.atomic(async tx => {
      const role = await this.role(user, id, tx);
      await this.assertMutableRole(user, role, tx);
      if (code === 'identity.admin' || code.startsWith('platform.')) throw new ForbiddenException('Administrative authorization cannot be delegated through a custom staff role');
      const permission = await tx.permission.findUnique({ where: { code } });
      if (!permission) throw new BadRequestException('Permission not found');
      if (remove) await tx.rolePermission.deleteMany({ where: { role_id: id, permission_id: permission.id } });
      else await tx.rolePermission.upsert({ where: { role_id_permission_id: { role_id: id, permission_id: permission.id } }, update: {}, create: { role_id: id, permission_id: permission.id } });
      await this.audit(tx, user, remove ? 'ROLE_PERMISSION_REMOVE' : 'ROLE_PERMISSION_ASSIGN', id);
      return this.safeRole(await this.role(user, id, tx));
    });
  }
  async listSessions(user: any, query: DirectoryQuery) {
    const id = query.user_id || user.id;
    if (id !== user.id) { if (!isTenantAdministrator(user)) throw new ForbiddenException('You can only view your own devices'); await this.staff(user, id); }
    return (await this.db.session.findMany({ where: { user_id: id, revoked_at: null, expires_at: { gt: new Date() } }, orderBy: { last_active_at: 'desc' }, ...this.paging(query) })).map(session => ({ ...session, current: session.id === user.session_id }));
  }
  async revokeSession(user: any, id: string) {
    return this.atomic(async tx => {
      const session = await tx.session.findFirst({ where: { id, user: { organization_id: user.organization_id } } });
      if (!session) throw new NotFoundException('Device session not found');
      if (session.user_id !== user.id) { if (!isTenantAdministrator(user)) throw new NotFoundException('Device session not found'); const staff = await this.staff(user, session.user_id, tx); this.assertMutableStaff(user, staff); }
      await tx.session.update({ where: { id }, data: { revoked_at: new Date() } }); await this.audit(tx, user, 'SESSION_REVOKE', id);
      return { success: true };
    });
  }
  async revokeStaffSessions(user: any, id: string) {
    return this.atomic(async tx => { const staff = await this.staff(user, id, tx); if (id !== user.id) this.assertMutableStaff(user, staff); await tx.session.updateMany({ where: { user_id: id, revoked_at: null }, data: { revoked_at: new Date() } }); await this.audit(tx, user, 'STAFF_SESSIONS_REVOKE', id); return { success: true }; });
  }
  async listOrganizations(user: any, query: DirectoryQuery) {
    return this.db.organization.findMany({ where: { id: user.organization_id, ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] } : {}) }, select: { id: true, code: true, name: true, legal_name: true, is_active: true, created_at: true } });
  }
  async updateOrganization(user: any, id: string, dto: OrganizationUpdateDto) {
    if (id !== user.organization_id) throw new NotFoundException('Organization not found');
    return this.atomic(async tx => { const org = await tx.organization.update({ where: { id }, data: dto, select: { id: true, code: true, name: true, legal_name: true, is_active: true, created_at: true } }); await this.audit(tx, user, 'ORGANIZATION_UPDATE', id); return org; });
  }
  async getOrganization(user: any, id: string) { if (id !== user.organization_id) throw new NotFoundException('Organization not found'); return (await this.listOrganizations(user, new DirectoryQuery()))[0]; }
  async listCompanies(user: any, query: DirectoryQuery) {
    const ids = (await this.db.userRole.findMany({ where: { user_id: user.id }, select: { company_id: true } })).map(role => role.company_id).filter((id): id is string => !!id);
    return this.db.company.findMany({ where: { id: { in: ids }, organization_id: user.organization_id, ...(query.q ? { OR: [{ code: { contains: query.q, mode: 'insensitive' } }, { legal_name: { contains: query.q, mode: 'insensitive' } }] } : {}) }, orderBy: { created_at: 'asc' }, ...this.paging(query) });
  }
  async createCompany(user: any, dto: CreateCompanyDto) {
    return this.db.runSystem(()=>this.createOwnedCompany(user,dto));
  }
  private async createOwnedCompany(user: any, dto: CreateCompanyDto) {
    if (dto.organization_id !== user.organization_id) throw new ForbiddenException('Business is outside this organization');
    if (typeof dto.legal_name !== 'string' || !dto.legal_name.trim()) throw new BadRequestException('Business legal name is required');
    this.validateCompanySettings(dto);
    return this.atomic(async tx => {
      await this.lock(tx, 'businesses:' + user.organization_id);
      const effective = await this.entitlements.resolve(user.organization_id, tx);
      const limit = Number((effective.limits as any).companies);
      if (Number.isFinite(limit) && limit > 0 && await tx.company.count({ where: { organization_id: user.organization_id, is_active: true } }) >= limit) throw new ForbiddenException('Your subscription business limit has been reached');
      const company = await tx.company.create({ data: { ...dto, organization_id: user.organization_id } });
      const branch = await tx.branch.create({ data: { company_id: company.id, code: 'HQ', name: 'Main Shop' } });
      await tx.godown.create({ data: { branch_id: branch.id, code: 'MAIN', name: 'Shop Stock' } });
      await tx.unit.create({ data: { company_id: company.id, code: 'PCS', name: 'Pieces' } });
      const now = new Date(); const year = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      await tx.financialYear.create({ data: { company_id: company.id, label: `${year}-${year + 1}`, start_date: new Date(`${year}-04-01`), end_date: new Date(`${year + 1}-03-31`), is_active: true } });
      const ledgers: Record<string, string> = {};
      for (const [code, name, type, normal] of [['CASH_IN_HAND', 'Cash in Hand', 'ASSET', 'DEBIT'], ['DEFAULT_BANK', 'Default Bank', 'ASSET', 'DEBIT'], ['SALES_REVENUE', 'Sales Revenue', 'REVENUE', 'CREDIT'], ['OUTPUT_GST', 'Output GST', 'LIABILITY', 'CREDIT'], ['DIR-EXP', 'Direct Expenses', 'EXPENSE', 'DEBIT'], ['PURCH', 'Purchase Account', 'EXPENSE', 'DEBIT'], ['OWNER_CAPITAL', 'Owner Capital', 'EQUITY', 'CREDIT']]) {
        const ledger = await tx.ledgerAccount.create({ data: { company_id: company.id, branch_id: branch.id, code, name, account_type: type, normal_balance: normal, is_system: true } }); ledgers[code] = ledger.id;
      }
      await tx.companyConfiguration.create({ data: { company_id: company.id, default_branch_id: branch.id, default_cash_ledger_id: ledgers.CASH_IN_HAND, default_bank_ledger_id: ledgers.DEFAULT_BANK } });
      await tx.retailCapabilitySettings.create({ data: { company_id: company.id } });
      const role = await tx.role.create({ data: { organization_id: user.organization_id, name: 'BUSINESS_ADMIN_' + company.id, description: 'Business owner administration', system_role: false } });
      await tx.permission.upsert({ where: { code: 'identity.admin' }, update: {}, create: { code: 'identity.admin', module: 'IDENTITY', resource: 'ALL', action: 'ADMIN' } });
      const permissions = await tx.permission.findMany({ where: { NOT: { code: { startsWith: 'platform.' } } } });
      await tx.rolePermission.createMany({ data: permissions.map((permission: any) => ({ role_id: role.id, permission_id: permission.id })) });
      await tx.userRole.create({ data: { user_id: user.id, role_id: role.id, company_id: company.id, branch_id: branch.id } });
      await this.audit(tx, user, 'COMPANY_CREATE', company.id); return company;
    });
  }
  private validateCompanySettings(dto: CompanyUpdateDto) {
    if (dto.timezone) { try { new Intl.DateTimeFormat('en', { timeZone: dto.timezone }).format(); } catch { throw new BadRequestException('Choose a valid business time zone'); } }
    if (dto.fy_start_month && dto.fy_start_month !== 4) throw new BadRequestException('Retail V1 uses the Indian April to March financial year');
  }
  async updateCompany(user: any, id: string, dto: CompanyUpdateDto) { this.validateCompanySettings(dto); return this.atomic(async tx => { await this.company(user, id, tx); const company = await tx.company.update({ where: { id }, data: dto }); await this.audit(tx, user, 'COMPANY_UPDATE', id); return company; }); }
  getCompany(user: any, id: string) { return this.company(user, id); }
  async companyStatus(user: any, id: string, active: boolean) {
    if (id === user.company_id && !active) throw new ConflictException('Switch to another business before disabling this business');
    return this.atomic(async tx => {
      await this.lock(tx,'businesses:'+user.organization_id);
      const original=await this.company(user, id, tx);
      if(active&&!original.is_active){const effective=await this.entitlements.resolve(user.organization_id,tx);const limit=Number((effective.limits as any).companies);if(Number.isFinite(limit)&&await tx.company.count({where:{organization_id:user.organization_id,is_active:true}})>=limit)throw new ForbiddenException('Your subscription business limit has been reached');}
      const company = await tx.company.update({ where: { id }, data: { is_active: active } }); await this.audit(tx, user, active ? 'COMPANY_ENABLE' : 'COMPANY_DISABLE', id); return company;
    });
  }
  async listBranches(user: any, query: DirectoryQuery) { return this.db.branch.findMany({ where: { company_id: user.company_id, ...(query.q ? { OR: [{ code: { contains: query.q, mode: 'insensitive' } }, { name: { contains: query.q, mode: 'insensitive' } }] } : {}) }, orderBy: { created_at: 'asc' }, ...this.paging(query) }); }
  async createBranch(user: any, dto: CreateBranchDto) {
    if (dto.company_id !== user.company_id) throw new ForbiddenException('Store is outside this business');
    if (typeof dto.name !== 'string' || !dto.name.trim()) throw new BadRequestException('Store name is required');
    return this.atomic(async tx => {
      await this.lock(tx, 'locations:' + user.company_id); const effective=await this.requireMultipleLocations(user, tx);
      const branchLimit=Number((effective.limits as any).branches),locationLimit=Number((effective.limits as any).stock_locations);
      if(Number.isFinite(branchLimit)&&await tx.branch.count({where:{company_id:user.company_id,is_active:true}})>=branchLimit)throw new ForbiddenException('Your store limit has been reached');
      if(Number.isFinite(locationLimit)&&await tx.godown.count({where:{branch:{company_id:user.company_id},is_active:true}})>=locationLimit)throw new ForbiddenException('Your stock location limit has been reached');
      const branch = await tx.branch.create({ data: dto }); await tx.godown.create({ data: { branch_id: branch.id, code: 'MAIN', name: 'Shop Stock' } });
      await this.audit(tx, user, 'BRANCH_CREATE', branch.id); return branch;
    });
  }
  async updateBranch(user: any, id: string, dto: BranchUpdateDto) { return this.atomic(async tx => { await this.branch(user, id, tx); const branch = await tx.branch.update({ where: { id }, data: dto }); await this.audit(tx, user, 'BRANCH_UPDATE', id); return branch; }); }
  getBranch(user: any, id: string) { return this.branch(user, id); }
  async branchStatus(user: any, id: string, active: boolean) {
    if (id === user.branch_id && !active) throw new ConflictException('You cannot disable your current store');
    return this.atomic(async tx => {
      await this.lock(tx,'locations:'+user.company_id);const original=await this.branch(user, id, tx);
      if(active&&!original.is_active){const effective=await this.requireMultipleLocations(user,tx);const limit=Number((effective.limits as any).branches);if(Number.isFinite(limit)&&await tx.branch.count({where:{company_id:user.company_id,is_active:true}})>=limit)throw new ForbiddenException('Your store limit has been reached');}
      const branch = await tx.branch.update({ where: { id }, data: { is_active: active } }); await this.audit(tx, user, active ? 'BRANCH_ENABLE' : 'BRANCH_DISABLE', id); return branch;
    });
  }
  async listLocations(user: any, query: DirectoryQuery) {
    if (query.branch_id) await this.branch(user, query.branch_id);
    return this.db.godown.findMany({ where: { branch: { company_id: user.company_id }, ...(query.branch_id ? { branch_id: query.branch_id } : {}), ...(query.q ? { OR: [{ code: { contains: query.q, mode: 'insensitive' } }, { name: { contains: query.q, mode: 'insensitive' } }] } : {}) }, orderBy: { created_at: 'asc' }, ...this.paging(query) });
  }
  async createLocation(user: any, dto: CreateLocationDto) {
    if (typeof dto.name !== 'string' || !dto.name.trim()) throw new BadRequestException('Stock location name is required');
    return this.atomic(async tx => { await this.lock(tx, 'locations:' + user.company_id); await this.branch(user, dto.branch_id, tx); const effective=await this.requireMultipleLocations(user, tx);
      const limit=Number((effective.limits as any).stock_locations);
      if(Number.isFinite(limit)&&await tx.godown.count({where:{branch:{company_id:user.company_id},is_active:true}})>=limit)throw new ForbiddenException('Your stock location limit has been reached');
      const location = await tx.godown.create({ data: dto }); await this.audit(tx, user, 'LOCATION_CREATE', location.id); return location; });
  }
  async updateLocation(user: any, id: string, dto: LocationUpdateDto) { return this.atomic(async tx => { await this.location(user, id, tx); const location = await tx.godown.update({ where: { id }, data: dto }); await this.audit(tx, user, 'LOCATION_UPDATE', id); return location; }); }
  getLocation(user: any, id: string) { return this.location(user, id); }
  async locationStatus(user: any, id: string, active: boolean) {
    return this.atomic(async tx => {
      await this.lock(tx, 'locations:' + user.company_id); const original = await this.location(user, id, tx);
      if(active&&!original.is_active){const effective=await this.requireMultipleLocations(user,tx);const limit=Number((effective.limits as any).stock_locations);if(Number.isFinite(limit)&&await tx.godown.count({where:{branch:{company_id:user.company_id},is_active:true}})>=limit)throw new ForbiddenException('Your stock location limit has been reached');}
      if (!active) {
        if (await tx.godown.count({ where: { branch_id: original.branch_id, is_active: true } }) <= 1) throw new ConflictException('Keep at least one stock location active for this store');
        if (await tx.stockBalanceProjection.count({ where: { company_id: user.company_id, godown_id: id, quantity: { not: 0 } } })) throw new ConflictException('Transfer remaining stock before disabling this location');
      }
      const location = await tx.godown.update({ where: { id }, data: { is_active: active } }); await this.audit(tx, user, active ? 'LOCATION_ENABLE' : 'LOCATION_DISABLE', id); return location;
    });
  }
  async listFinancialYears(user: any, query: DirectoryQuery) { return this.db.financialYear.findMany({ where: { company_id: user.company_id, ...(query.q ? { label: { contains: query.q, mode: 'insensitive' } } : {}) }, orderBy: { start_date: 'desc' }, ...this.paging(query) }); }
  async getFinancialYear(user: any, id: string) { const fy = await this.db.financialYear.findFirst({ where: { id, company_id: user.company_id } }); if (!fy) throw new NotFoundException('Financial year not found'); return fy; }
  async createFinancialYear(user: any, dto: CreateFinancialYearDto) {
    if (dto.company_id !== user.company_id) throw new ForbiddenException('Financial year is outside this business');
    const start = new Date(dto.start_date), end = new Date(dto.end_date);
    if (start > end) throw new BadRequestException('End date must be after the start date');
    return this.atomic(async tx => { await this.lock(tx, 'financial-years:' + user.company_id);
      if (await tx.financialYear.findFirst({ where: { company_id: user.company_id, start_date: { lte: end }, end_date: { gte: start } } })) throw new ConflictException('Financial year overlaps with existing dates');
      const fy = await tx.financialYear.create({ data: { company_id: user.company_id, label: dto.label, start_date: start, end_date: end } }); await this.audit(tx, user, 'FINANCIAL_YEAR_CREATE', fy.id); return fy;
    });
  }
  async financialYearAction(user: any, id: string, close: boolean) {
    return this.atomic(async tx => { await this.lock(tx, 'financial-years:' + user.company_id); const fy = await tx.financialYear.findFirst({ where: { id, company_id: user.company_id } });
      if (!fy) throw new NotFoundException('Financial year not found');
      if (fy.is_closed) throw new ConflictException('This financial year is permanently closed');
      if (!close) await tx.financialYear.updateMany({ where: { company_id: user.company_id }, data: { is_active: false } });
      const changed = await tx.financialYear.update({ where: { id }, data: close ? { is_closed: true, is_active: false } : { is_active: true } });
      await this.audit(tx, user, close ? 'FINANCIAL_YEAR_CLOSE' : 'FINANCIAL_YEAR_ACTIVATE', id); return changed;
    });
  }
}
