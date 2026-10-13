import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import { IsString, MinLength, MaxLength, IsOptional, IsUUID, Matches } from 'class-validator';

class PlatformLoginDto {
  @IsString() @MinLength(1) @MaxLength(255) username: string;
  @IsString() @MinLength(1) @MaxLength(255) password: string;
  @IsOptional() @IsUUID() device_id?: string;
}
class PlatformMfaDto {
  @IsUUID() challenge_id:string;
  @IsString() @Matches(/^(?:\d{6}|[A-Z0-9]{6}(?:-[A-Z0-9]{6}){3})$/i) code:string;
}

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() signInDto: PlatformLoginDto, @Req() req: any) {
    return this.platformAuthService.login(signInDto.username, signInDto.password, { ip: req.ip, userAgent: req.headers['user-agent'],deviceId:signInDto.device_id });
  }
  @HttpCode(HttpStatus.OK) @Post('mfa/verify')
  verifyMfa(@Body() dto:PlatformMfaDto,@Req() req:any){return this.platformAuthService.verifyMfa(dto.challenge_id,dto.code,req.ip);}

  @Post('logout') @UseGuards(PlatformAuthGuard)
  logout(@Req() req: any) {
    return this.platformAuthService.logout(req.user.sub, req.user.sid);
  }
}
