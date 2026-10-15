import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ActivationCampaignInput, ActivationCampaignService } from '../auth/activation-campaign.service';
import { PlatformAuthGuard } from './auth/platform-auth.guard';
class ActivationCampaignDto implements ActivationCampaignInput {
 @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/) code:string;
 @IsString() @MinLength(1) @MaxLength(200) name:string;
 @IsBoolean() enabled:boolean;
 @IsIn(['STARTER','SMART','PRO']) plan_code:string;
 @IsInt() @Min(1) @Max(60) trial_days:number;
 @IsOptional() @IsInt() @Min(1) @Max(1000000) max_redemptions?:number|null;
 @IsDateString() starts_at:string;
 @IsOptional() @IsDateString() ends_at?:string|null;
 @IsString() @MinLength(3) @MaxLength(2000) reason:string;
}
@Controller('platform/admin/activation-campaigns')
@UseGuards(PlatformAuthGuard)
export class ActivationCampaignController {
 constructor(private campaigns:ActivationCampaignService) {}
 @Get() list(){return this.campaigns.list();}
 @Post() create(@Body() dto:ActivationCampaignDto,@Req() req:any){return this.campaigns.save(dto,req.platformUser.id);}
 @Patch(':id') update(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ActivationCampaignDto,@Req() req:any){return this.campaigns.save(dto,req.platformUser.id,id);}
}
