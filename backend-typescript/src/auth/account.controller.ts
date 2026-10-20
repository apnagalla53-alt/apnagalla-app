import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsArray, ArrayMaxSize, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccountSessionGuard } from './account-session.guard';
import { MobileOtpService } from './mobile-otp.service';
import { OnboardingService } from './onboarding.service';
import { ReferralService } from './referral.service';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { validatePassword } from './password-policy';
import { auditIdentityChange } from './auth-audit';
import { ActivationCampaignService } from './activation-campaign.service';
class ActivationCodeDto { @IsString() @MinLength(3) @MaxLength(40) code:string; }
class InitialPasswordDto { @IsString() @MinLength(8) @MaxLength(72) password:string; }
class RequestOtpDto {
  @IsString() @MinLength(10) @MaxLength(25) phone: string;
  @IsIn(['SIGN_IN','SIGN_UP']) purpose: 'SIGN_IN'|'SIGN_UP';
  @IsBoolean() terms_accepted: boolean;
  @IsOptional() @IsString() @MaxLength(30) referral_code?: string;
}
class VerifyOtpDto {
  @IsUUID() challenge_id: string;
  @IsString() @Matches(/^\d{6}$/) code: string;
  @IsOptional() @IsUUID() device_id?: string;
}
class LinkRequestDto { @IsString() @MinLength(10) @MaxLength(25) phone: string; }
class LinkVerifyDto extends VerifyOtpDto { @IsString() @MinLength(1) @MaxLength(255) current_password: string; }
class OwnerDto { @IsString() @MinLength(1) @MaxLength(255) name: string; }
class BusinessDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({each:true}) additional_business_types?: string[];
  @IsString() @MaxLength(50) business_type: string;
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsString() @MinLength(1) @MaxLength(1000) address: string;
  @IsOptional() @IsString() @MaxLength(20) postal_code?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() @MaxLength(100) custom_business_type?: string;
  @IsOptional() @IsString() @MaxLength(25) mobile?: string;
}
class BusinessProfileDto extends BusinessDto {
  @IsString() @MinLength(1) @MaxLength(255) owner_name:string;
  @IsString() @MinLength(10) @MaxLength(25) mobile:string='';
}
class PlanChoiceDto { @IsIn(['TRIAL','REQUEST']) choice: 'TRIAL'|'REQUEST'; @IsOptional() @IsIn(['STARTER','SMART','PRO']) plan_code?: string; }
class MigrationDto { @IsIn(['FRESH','IMPORT']) choice: 'FRESH'|'IMPORT'; @IsOptional() @IsUUID() device_id?: string; }
@Controller('auth/account')
export class AccountController {
  constructor(private otp: MobileOtpService, private onboarding: OnboardingService, private referrals: ReferralService, private db: PrismaService, private campaigns:ActivationCampaignService) {}
  @Post('password/create') @UseGuards(AccountSessionGuard)
  async createPassword(@Body() dto:InitialPasswordDto,@Req() req:any){
   validatePassword(dto.password);
   if(req.account.issued_at.getTime()<Date.now()-300000)throw new BadRequestException('Sign in again with your verified mobile or Google account before setting a password.');
   const hash=await bcrypt.hash(dto.password,12);return this.db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM users WHERE id=${req.account.id}::uuid FOR UPDATE`;
    const user=await tx.user.findUniqueOrThrow({where:{id:req.account.id}});
    if(user.password_login_enabled||(!user.google_subject&&!user.phone_verified_at))throw new BadRequestException('Use Change password for an existing password account.');
    await tx.user.update({where:{id:user.id},data:{password_hash:hash,password_login_enabled:true,password_changed_at:new Date()}});
    await tx.session.updateMany({where:{user_id:user.id,revoked_at:null},data:{revoked_at:new Date()}});await auditIdentityChange(tx,user.id,'PASSWORD_CREATED');return {success:true,message:'Password created. Sign in again to continue.'};
   });
  }
  @Post('otp/request') @HttpCode(200)
  request(@Body() dto: RequestOtpDto, @Req() req: any) { return this.otp.request(dto.phone, dto.purpose, dto.terms_accepted, dto.referral_code, req.ip); }
  @Post('otp/verify') @HttpCode(200)
  verify(@Body() dto: VerifyOtpDto, @Req() req: any) { return this.otp.verify(dto.challenge_id, dto.code, { ip: req.ip, userAgent: req.headers['user-agent'], deviceId: dto.device_id }); }
  @Post('mobile/request-link') @UseGuards(AccountSessionGuard)
  requestLink(@Body() dto: LinkRequestDto, @Req() req: any) { return this.otp.request(dto.phone, 'LINK', false, undefined, req.ip, req.account.id); }
  @Post('mobile/verify-link') @UseGuards(AccountSessionGuard)
  verifyLink(@Body() dto: LinkVerifyDto, @Req() req: any) { return this.otp.verify(dto.challenge_id, dto.code, { ip: req.ip }, req.account.id, dto.current_password); }
  @Get('onboarding') @UseGuards(AccountSessionGuard)
  state(@Req() req: any) { return this.onboarding.state(req.account.id); }
  @Post('onboarding/activation-request') @UseGuards(AccountSessionGuard)
  activationRequest(@Req() req:any) { return this.onboarding.requestActivation(req.account.id); }
  @Post('onboarding/activation-code') @UseGuards(AccountSessionGuard)
  async activationCode(@Body() dto:ActivationCodeDto,@Req() req:any) { const applied=await this.campaigns.redeem(req.account.id,dto.code);return {...await this.onboarding.state(req.account.id),code_result:applied}; }
  @Post('onboarding/owner') @UseGuards(AccountSessionGuard)
  owner(@Body() dto: OwnerDto, @Req() req: any) { return this.onboarding.owner(req.account.id, dto.name); }
  @Post('onboarding/business') @UseGuards(AccountSessionGuard)
  business(@Body() dto: BusinessDto, @Req() req: any) { return this.onboarding.business(req.account.id, dto); }
  @Post('onboarding/profile') @UseGuards(AccountSessionGuard)
  profile(@Body() dto:BusinessProfileDto,@Req() req:any){return this.onboarding.profile(req.account.id,dto);}
  @Post('onboarding/plan') @UseGuards(AccountSessionGuard)
  plan(@Body() dto: PlanChoiceDto, @Req() req: any) { return this.onboarding.plan(req.account.id, dto.choice, dto.plan_code); }
  @Post('onboarding/migration') @UseGuards(AccountSessionGuard)
  migration(@Body() dto: MigrationDto, @Req() req: any) { return this.onboarding.migration(req.account.id, dto.choice, { ip: req.ip, userAgent: req.headers['user-agent'], deviceId: dto.device_id }); }
  @Post('logout') @UseGuards(AccountSessionGuard)
  async logout(@Req() req: any) { await this.db.session.updateMany({ where: { id: req.account.session_id, user_id: req.account.id }, data: { revoked_at: new Date() } }); return { success: true }; }
}
