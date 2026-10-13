import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import { PlatformService } from './platform.service';
import { PlatformAuthGuard } from './auth/platform-auth.guard';

class PublishingDto {
  @IsString() @MinLength(1) @MaxLength(255) developer_name: string;
  @IsOptional() @IsString() @MaxLength(255) legal_name?: string;
  @IsOptional() @IsString() @MaxLength(2000) business_address?: string;
  @IsOptional() @IsEmail() support_email?: string;
  @IsOptional() @IsUrl({ protocols:['https'],require_protocol:true }) website?: string;
  @IsOptional() @Matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/) android_package?: string;
  @IsOptional() @IsString() @MaxLength(10000) privacy_text?: string;
  @IsOptional() @IsString() @MaxLength(10000) terms_text?: string;
  @IsOptional() @IsString() @MaxLength(2000) retention_policy?: string;
  @IsBoolean() policies_approved: boolean;
  @IsString() @MinLength(3) @MaxLength(2000) reason: string;
}
export const publishingDefaults = { developer_name:'EVOLIX Studio',website:'https://evolix-studio.in',legal_name:'',business_address:'',
  support_email:'',android_package:'',privacy_text:'',terms_text:'',retention_policy:'',policies_approved:false };

@Controller('public')
export class PublicAppController {
  constructor(private db:PrismaService) {}
  @Get('app-information')
  async information() {
    const saved=(await this.db.platformSetting.findUnique({where:{key:'APP_PUBLISHING'}}))?.value as any;
    const values={...publishingDefaults,...saved};
    delete values.reason;
    return { ...values, published:!!values.policies_approved&&!!values.support_email&&!!values.legal_name&&!!values.retention_policy,
      product_name:'EVOLIX Retail',version:process.env.APP_VERSION||'development' };
  }
}
@Controller('platform/admin/publishing')
@UseGuards(PlatformAuthGuard)
export class PlatformPublishingController {
  constructor(private db:PrismaService,private platform:PlatformService) {}
  @Get()
  async get() { return {...publishingDefaults,...(await this.db.platformSetting.findUnique({where:{key:'APP_PUBLISHING'}}))?.value as any}; }
  @Post()
  async save(@Body() dto:PublishingDto,@Req() req:any) {
    const {reason,...value}=dto;
    return this.db.$transaction(async tx=>{
      await tx.platformSetting.upsert({where:{key:'APP_PUBLISHING'},create:{key:'APP_PUBLISHING',value},update:{value}});
      await this.platform.audit(tx,req.user.sub,'APP_PUBLISHING_UPDATE','PlatformSetting',undefined,{reason,policies_approved:value.policies_approved});
      return value;
    });
  }
  @Get('privacy-requests')
  requests() { return this.db.privacyRequest.findMany({orderBy:{created_at:'desc'},take:200}); }
}
