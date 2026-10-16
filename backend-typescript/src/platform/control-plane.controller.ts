import { ShopFreshStartService } from './shop-fresh-start.service';
import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccountPolicyService, AccountPolicy } from '../auth/account-policy.service';
import { ReferralService } from '../auth/referral.service';
import { PlatformAuthGuard } from './auth/platform-auth.guard';
import { AuthGuard, RequirePermissions } from '../common/guards/auth.guard';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantCredentialsService } from './tenant-credentials.service';
import { PrismaService } from '../database/prisma.service';
import { TenantUserLifecycleService } from './tenant-user-lifecycle.service';
class FreshStartDto { @IsUUID() company_id:string; @IsString() @MinLength(3) @MaxLength(1000) reason:string; @IsString() @MaxLength(255) password:string; @IsString() @MaxLength(100) confirmation:string; }
class LifecycleDto { @IsString() @MinLength(3) @MaxLength(2000) reason:string; }
class CredentialsDto extends LifecycleDto { @IsIn(['RESET_LINK','FORCE_CHANGE','TEMPORARY','REVOKE']) action:'RESET_LINK'|'FORCE_CHANGE'|'TEMPORARY'|'REVOKE'; @IsOptional() @IsString() @MinLength(8) @MaxLength(72) temporary_password?:string; }
class PurgeDto extends LifecycleDto { @IsString() @MaxLength(100) confirmation:string; }
class TenantMetadataDto extends LifecycleDto {
 @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?:string;
 @IsOptional() @IsString() @MinLength(1) @MaxLength(50) code?:string;
 @IsOptional() @IsString() @MaxLength(100) business_type?:string;
 @IsOptional() @IsBoolean() legal_hold?:boolean;
 @IsOptional() @IsUUID() company_id?:string;
 @IsOptional() @IsString() @MaxLength(1000) address?:string;
 @IsOptional() @IsString() @MaxLength(100) city?:string;
 @IsOptional() @IsString() @MaxLength(100) state?:string;
 @IsOptional() @IsString() @MaxLength(20) postal_code?:string;
}
class TenantUserDto extends LifecycleDto {
 @IsOptional() @IsString() @MinLength(1) @MaxLength(255) display_name?:string;
 @IsOptional() @IsString() @MinLength(1) @MaxLength(255) username?:string;
 @IsOptional() @IsEmail() @MaxLength(255) email?:string;
 @IsOptional() @IsString() @MaxLength(50) phone?:string;
}
class TenantRoleDto extends LifecycleDto { @IsUUID() role_id:string; @IsUUID() company_id:string; @IsOptional() @IsUUID() branch_id?:string; }
import { PermissionGuard } from '../common/guards/permission.guard';
class AccountPolicyDto implements AccountPolicy {
 @IsBoolean() trial_enabled: boolean;
 @IsOptional() @IsInt() @Min(1) @Max(365) trial_days: number|null;
 @IsIn(['STARTER','SMART','PRO']) trial_plan: 'STARTER'|'SMART'|'PRO';
 @IsBoolean() permanent_delete_enabled: boolean;
 @IsOptional() @IsInt() @Min(0) @Max(3650) retention_days: number|null;
 @IsBoolean() delete_requires_backup: boolean;
 @IsString() @MinLength(3) @MaxLength(2000) reason: string;
}
class CampaignDto {
 @IsString() @MinLength(1) @MaxLength(40) code:string;
 @IsString() @MinLength(1) @MaxLength(200) name:string;
 @IsBoolean() enabled:boolean;
 @IsIn(['TRACKING_ONLY','SUBSCRIPTION_DAYS','ACCOUNT_CREDIT','FIXED_REWARD']) reward_type:string;
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(100000) reward_value:number;
 @IsIn(['SIGNED_UP','PAID_SUBSCRIPTION','ACTIVE_DAYS']) qualification:string;
 @IsInt() @Min(0) @Max(365) active_days:number;
 @IsDateString() starts_at:string;
 @IsOptional() @IsDateString() ends_at?:string;
 @IsString() @MinLength(1) @MaxLength(4000) rules:string;
 @IsString() @MinLength(3) @MaxLength(2000) reason:string;
}
class ReviewDto { @IsIn(['refresh','approve','reject']) action:'refresh'|'approve'|'reject'; @IsString() @MinLength(3) @MaxLength(2000) reason:string; @IsOptional() @IsString() @MaxLength(255) reference?:string; }
@UseGuards(PlatformAuthGuard)
@Controller('platform/admin')
export class ControlPlaneController {
 constructor(private freshStart:ShopFreshStartService,private policy:AccountPolicyService,private referrals:ReferralService,private lifecycle:TenantLifecycleService,private credentials:TenantCredentialsService,private db:PrismaService,private userLifecycle:TenantUserLifecycleService){}
 @Get('tenants/:id/fresh-start-preview') freshPreview(@Param('id',ParseUUIDPipe) id:string){return this.freshStart.preview(id);}
 @Post('tenants/:id/fresh-start') fresh(@Param('id',ParseUUIDPipe) id:string,@Body() dto:FreshStartDto,@Req() req:any){return this.freshStart.start(id,dto.company_id,dto.confirmation,dto.password,dto.reason,req.platformUser.id);}
 @Post('tenants/:id/fresh-start-restore') freshRestore(@Param('id',ParseUUIDPipe) id:string,@Body() dto:FreshStartDto,@Req() req:any){return this.freshStart.restore(id,dto.company_id,dto.password,dto.reason,req.platformUser.id);}
 @Get('tenants/:id/users/:userId/deletion-preview') userPreview(@Param('id',ParseUUIDPipe) id:string,@Param('userId',ParseUUIDPipe) userId:string){return this.userLifecycle.preview(id,userId);}
 @Post('tenants/:id/users/:userId/delete') userDelete(@Param('id',ParseUUIDPipe) id:string,@Param('userId',ParseUUIDPipe) userId:string,@Body() dto:PurgeDto,@Req() req:any){return this.userLifecycle.remove(id,userId,dto.confirmation,dto.reason,req.platformUser.id);}
 @Get('tenants/:id/roles') roles(@Param('id',ParseUUIDPipe) id:string){return this.db.role.findMany({where:{organization_id:id,NOT:{name:{in:['SUPER_ADMIN','PLATFORM_ADMIN']}}},select:{id:true,name:true}});}
 @Patch('tenants/:id/users/:userId') editUser(@Param('id',ParseUUIDPipe) id:string,@Param('userId',ParseUUIDPipe) userId:string,@Body() dto:TenantUserDto,@Req() req:any){return this.db.$transaction(async tx=>{
   const user=await tx.user.findFirst({where:{id:userId,organization_id:id}});if(!user)throw new BadRequestException('Tenant user not found.');
   if(dto.username&&await tx.user.findFirst({where:{username:dto.username.trim(),NOT:{id:userId}}}))throw new BadRequestException('This username is already used.');
   const patch={...(dto.display_name!=null&&{display_name:dto.display_name.trim()}),...(dto.username!=null&&{username:dto.username.trim()}),...(dto.email!==undefined&&{email:dto.email||null,email_verified_at:dto.email===user.email?user.email_verified_at:null}),...(dto.phone!==undefined&&{phone:dto.phone||null})};
   if(patch.display_name===''||patch.username==='')throw new BadRequestException('Name and username cannot be blank.');
   await tx.user.update({where:{id:userId},data:patch});if(dto.username!==undefined||dto.email!==undefined)await tx.session.updateMany({where:{user_id:userId,revoked_at:null},data:{revoked_at:new Date()}});
   await tx.platformAuditLog.create({data:{user_id:req.platformUser.id,action:'TENANT_USER_UPDATE',resource_type:'Organization',resource_id:id,details:JSON.stringify({target_user:userId,reason:dto.reason,changed_fields:Object.keys(patch)})}});return {success:true};
 });}
 @Post('tenants/:id/users/:userId/role') role(@Param('id',ParseUUIDPipe) id:string,@Param('userId',ParseUUIDPipe) userId:string,@Body() dto:TenantRoleDto,@Req() req:any){return this.db.$transaction(async tx=>{
   const user=await tx.user.findFirst({where:{id:userId,organization_id:id}}),role=await tx.role.findFirst({where:{id:dto.role_id,organization_id:id,NOT:{name:{in:['SUPER_ADMIN','PLATFORM_ADMIN']}}}}),company=await tx.company.findFirst({where:{id:dto.company_id,organization_id:id}});
   if(!user||!role||!company)throw new BadRequestException('User, tenant role and company must belong to this tenant.');
   if(dto.branch_id&&!await tx.branch.findFirst({where:{id:dto.branch_id,company_id:company.id}}))throw new BadRequestException('Branch does not belong to this company.');
   const oldRoles=await tx.userRole.findMany({where:{user_id:userId},include:{role:true}});
   if(oldRoles.some(r=>['TENANT_ADMIN','OWNER','ADMIN'].includes(r.role.name))&&!['TENANT_ADMIN','OWNER','ADMIN'].includes(role.name)&&!await tx.userRole.count({where:{user_id:{not:userId},user:{organization_id:id,is_active:true},role:{name:{in:['TENANT_ADMIN','OWNER','ADMIN']}}}}))throw new BadRequestException('Assign another active owner before removing the last owner role.');
   await tx.userRole.deleteMany({where:{user_id:userId}});await tx.userRole.create({data:{user_id:userId,role_id:role.id,company_id:company.id,branch_id:dto.branch_id||null}});await tx.session.updateMany({where:{user_id:userId,revoked_at:null},data:{revoked_at:new Date()}});
   await tx.platformAuditLog.create({data:{user_id:req.platformUser.id,action:'TENANT_USER_ROLE_UPDATE',resource_type:'Organization',resource_id:id,details:JSON.stringify({target_user:userId,role_id:role.id,previous_roles:oldRoles.map(r=>r.role_id),reason:dto.reason})}});return {success:true};
 });}
 @Patch('tenants/:id/metadata') metadata(@Param('id',ParseUUIDPipe) id:string,@Body() dto:TenantMetadataDto,@Req() req:any){return this.db.$transaction(async tx=>{
   const org=await tx.organization.findUnique({where:{id}});if(!org)throw new BadRequestException('Tenant not found.');
   if(dto.code&&await tx.organization.findFirst({where:{code:dto.code.trim(),NOT:{id}}}))throw new BadRequestException('This business code is already in use.');
   if(dto.name!==undefined&&!dto.name.trim()||dto.code!==undefined&&!dto.code.trim())throw new BadRequestException('Business name and code cannot be blank.');
   const patch={...(dto.name!==undefined&&{name:dto.name.trim()}),...(dto.code!==undefined&&{code:dto.code.trim()}),...(dto.business_type!==undefined&&{business_type:dto.business_type}),...(dto.legal_hold!==undefined&&{legal_hold:dto.legal_hold})};
   if(dto.company_id){const c=await tx.company.findFirst({where:{id:dto.company_id,organization_id:id}});if(!c)throw new BadRequestException('Company does not belong to this tenant.');await tx.company.update({where:{id:c.id},data:{...(dto.address!==undefined&&{address:dto.address}),...(dto.city!==undefined&&{city:dto.city}),...(dto.state!==undefined&&{state:dto.state}),...(dto.postal_code!==undefined&&{postal_code:dto.postal_code})}});}
   await tx.organization.update({where:{id},data:patch});await tx.platformAuditLog.create({data:{user_id:req.platformUser.id,action:'TENANT_METADATA_UPDATE',resource_type:'Organization',resource_id:id,details:JSON.stringify({reason:dto.reason,previous:{name:org.name,code:org.code,legal_hold:org.legal_hold},patch})}});return {success:true,id};
 });}
 @Post('tenants/:id/users/:userId/credentials') credentialsAction(@Param('id',ParseUUIDPipe) id:string,@Param('userId',ParseUUIDPipe) userId:string,@Body() dto:CredentialsDto,@Req() req:any){return this.credentials.reset(id,userId,dto.action,dto.reason,req.platformUser.id,dto.temporary_password);}
 @Get('tenants/:id/deletion-preview') preview(@Param('id',ParseUUIDPipe) id:string){return this.lifecycle.preview(id);}
 @Post('tenants/:id/archive') archive(@Param('id',ParseUUIDPipe) id:string,@Body() dto:LifecycleDto,@Req() req:any){return this.lifecycle.archive(id,dto.reason,req.platformUser.id);}
 @Post('tenants/:id/restore') restore(@Param('id',ParseUUIDPipe) id:string,@Body() dto:LifecycleDto,@Req() req:any){return this.lifecycle.archive(id,dto.reason,req.platformUser.id,true);}
 @Post('tenants/:id/permanent-delete') purge(@Param('id',ParseUUIDPipe) id:string,@Body() dto:PurgeDto,@Req() req:any){return this.lifecycle.purge(id,dto.confirmation,dto.reason,req.platformUser.id);}
 @Get('deletion-jobs') deletionJobs(){return this.lifecycle.deletionJobs();}
 @Post('deletion-jobs/:id/retry') retryDeletion(@Param('id',ParseUUIDPipe) id:string,@Body() dto:LifecycleDto,@Req() req:any){return this.db.platformAuditLog.create({data:{user_id:req.platformUser.id,action:'TENANT_STORAGE_ERASURE_RETRY',resource_type:'TenantDeletionJob',resource_id:id,details:JSON.stringify({reason:dto.reason})}}).then(()=>this.lifecycle.finishStorage(id,req.platformUser.id));}
 @Get('account-policy') getPolicy(){return this.policy.get();}
 @Post('account-policy') savePolicy(@Body() dto:AccountPolicyDto,@Req() req:any){const {reason,...policy}=dto;return this.policy.save(policy,reason,req.platformUser.id);}
 @Get('referrals') list(@Query() query:any){return this.referrals.list(query);}
 @Get('referral-campaigns') campaigns(){return this.referrals.campaigns();}
 @Post('referral-campaigns') create(@Body() dto:CampaignDto,@Req() req:any){return this.referrals.saveCampaign(dto,req.platformUser.id);}
 @Patch('referral-campaigns/:id') update(@Param('id',ParseUUIDPipe) id:string,@Body() dto:CampaignDto,@Req() req:any){return this.referrals.saveCampaign(dto,req.platformUser.id,id);}
 @Post('referrals/:id/review') review(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ReviewDto,@Req() req:any){return this.referrals.review(id,dto,req.platformUser.id);}
}
@Controller('api/v1/retail/referrals')
@UseGuards(AuthGuard,PermissionGuard)
@RequirePermissions('identity.admin')
export class OwnerReferralController {
 constructor(private referrals:ReferralService){}
 @Get() get(@Req() req:any){return this.referrals.ownerSummary(req.user.id,req.user.organization_id);}
}
