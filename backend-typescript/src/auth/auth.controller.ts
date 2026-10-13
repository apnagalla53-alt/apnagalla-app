import { Controller, Get, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, MinLength, MaxLength, IsOptional, IsUUID, IsEmail, Matches } from 'class-validator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PrismaService } from '../database/prisma.service';
import { AuthEmailService } from './auth-email.service';
import { GoogleIdentityService } from './google-identity.service';
import { GoogleAuthService } from './google-auth.service';
import { PasswordLifecycleService } from './password-lifecycle.service';
import { PlatformAuthGuard } from '../platform/auth/platform-auth.guard';
import { PlatformPasswordService } from './platform-password.service';
import { IsBoolean } from 'class-validator';
import { SmsOtpProvider } from './sms-otp.provider';
import { AccountSessionGuard } from './account-session.guard';
import { requestToken, csrfForSession } from './browser-session';

class LoginDto {
  @IsString() @MinLength(1) @MaxLength(255) username: string;
  @IsString() @MinLength(1) @MaxLength(255) password: string;
  @IsOptional() @IsUUID() device_id?: string;
}

class CurrentPasswordDto {
  @IsString() @MinLength(1) @MaxLength(255) current_password: string;
}
class ChangePasswordDto extends CurrentPasswordDto {
  @IsString() @MinLength(12) @MaxLength(72) password: string;
}
class ResetRequestDto {
  @IsString() @MinLength(1) @MaxLength(255) identifier: string;
}
class TokenDto {
  @IsString() @MinLength(32) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) token: string;
}
class ResetPasswordDto extends TokenDto {
  @IsString() @MinLength(12) @MaxLength(72) password: string;
}
class VerifyEmailRequestDto extends CurrentPasswordDto {
  @IsEmail() @MaxLength(255) email: string;
}
class GoogleLoginDto {
  @IsUUID() challenge_id: string;
  @IsString() @MinLength(1) @MaxLength(8192) credential: string;
  @IsOptional() @IsUUID() device_id?: string;
}
class GoogleLinkDto extends GoogleLoginDto {
  @IsString() @MinLength(1) @MaxLength(255) current_password: string;
}
class GoogleSignupDto extends GoogleLoginDto {
  @IsBoolean() terms_accepted: boolean;
  @IsOptional() @IsString() @MaxLength(30) referral_code?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private prisma: PrismaService,
    private readonly email: AuthEmailService, private readonly googleIdentity: GoogleIdentityService,
    private readonly google: GoogleAuthService, private readonly passwords: PasswordLifecycleService, private readonly sms: SmsOtpProvider) {}

  @Get('capabilities')
  capabilities() { return { google_client_id: this.googleIdentity.clientId(), mobile_otp_configured: this.sms.configured(), password_recovery_configured: this.email.isConfigured(), payment_provider_configured: false }; }
  @Get('session') @UseGuards(AccountSessionGuard)
  async currentSession(@Req() req:any) {
    return { ...await this.authService.sessionProfile(req.account.id), session_mode:'cookie', csrf_token:csrfForSession(req.account.session_id) };
  }
  @Post('browser-session') @UseGuards(AccountSessionGuard)
  async browserSession(@Req() req:any){
    const u=await this.prisma.user.findUniqueOrThrow({where:{id:req.account.id},select:{id:true,username:true,display_name:true,email:true,phone:true,organization_id:true,onboarding_state:true,must_change_password:true}});
    return {access_token:requestToken(req),user:{id:u.id,username:u.username,display_name:u.display_name,email:u.email,phone:u.phone,organization_id:u.organization_id,onboarding_state:u.onboarding_state,must_change_password:u.must_change_password,is_platform:false,roles:[],permissions:[]}};
  }

  @Get('security') @UseGuards(AuthGuard)
  async security(@Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    return { google_connected: !!user?.google_subject, recovery_email: user?.email || null,
      recovery_email_verified: !!user?.email_verified_at, must_change_password: !!user?.must_change_password, password_login_enabled:user?.password_login_enabled!==false, mobile_connected:!!user?.phone_verified_at, mobile_number:user?.phone_e164||null };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() signInDto: LoginDto, @Req() req: any) {
    return this.authService.login(signInDto.username, signInDto.password, { ip: req.ip, userAgent: req.headers['user-agent'],deviceId:signInDto.device_id });
  }

  @Post('google/challenge')
  googleChallenge(@Req() req: any) { return this.google.challenge(undefined, req.ip); }

  @Post('google/signup-challenge')
  googleSignupChallenge(@Req() req: any) { return this.google.challenge(undefined, req.ip, true); }

  @Post('google/signup') @HttpCode(HttpStatus.OK)
  googleSignup(@Body() body: GoogleSignupDto, @Req() req: any) { return this.google.signup(body.challenge_id, body.credential, body.terms_accepted, body.referral_code, { ip: req.ip, userAgent: req.headers['user-agent'], deviceId: body.device_id }); }

  @Post('google/link-challenge') @UseGuards(AuthGuard)
  googleLinkChallenge(@Req() req: any) { return this.google.challenge(req.user.id, req.ip); }

  @Post('google/login') @HttpCode(HttpStatus.OK)
  googleLogin(@Body() body: GoogleLoginDto, @Req() req: any) {
    return this.google.login(body.challenge_id, body.credential, { ip: req.ip, userAgent: req.headers['user-agent'], deviceId: body.device_id });
  }

  @Post('google/link') @UseGuards(AuthGuard)
  googleLink(@Body() body: GoogleLinkDto, @Req() req: any) { return this.google.link(req.user.id, body.challenge_id, body.credential, body.current_password); }

  @Post('google/unlink') @UseGuards(AuthGuard)
  googleUnlink(@Body() body: CurrentPasswordDto, @Req() req: any) { return this.google.unlink(req.user.id, body.current_password); }

  @Post('password/forgot') @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: ResetRequestDto, @Req() req: any) { return this.passwords.requestReset(body.identifier, req.ip); }

  @Post('password/reset') @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: any) { return this.passwords.resetPassword(body.token, body.password, req.ip); }

  @Post('password/change') @UseGuards(AuthGuard)
  changePassword(@Body() body: ChangePasswordDto, @Req() req: any) { return this.passwords.changePassword(req.user.id, body.current_password, body.password); }

  @Post('email/request-verification') @UseGuards(AuthGuard)
  requestEmailVerification(@Body() body: VerifyEmailRequestDto, @Req() req: any) { return this.passwords.requestEmailVerification(req.user.id, body.email, body.current_password); }

  @Post('email/verify') @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() body: TokenDto, @Req() req: any) { return this.passwords.verifyEmail(body.token, req.ip); }

  @Post('logout') @UseGuards(AuthGuard)
  async logout(@Req() req: any) {
    await this.prisma.session.updateMany({ where: { id: req.user.session_id, user_id: req.user.id }, data: { revoked_at: new Date() } });
    return { success: true };
  }
}

@Controller('platform/auth/password')
export class PlatformPasswordController {
  constructor(private readonly passwords: PlatformPasswordService) {}
  @Post('change') @UseGuards(PlatformAuthGuard)
  change(@Body() body: ChangePasswordDto, @Req() req: any) {
    return this.passwords.change(req.platformUser.id, body.current_password, body.password);
  }
}
