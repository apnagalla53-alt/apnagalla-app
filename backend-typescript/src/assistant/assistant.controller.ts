import { Body,Controller,Get,Post,Req,UseGuards,Query,Param,ParseUUIDPipe,Patch } from '@nestjs/common';
import { IsBoolean,IsIn,IsInt,IsOptional,IsString,IsUUID,Max,MaxLength,Min,MinLength } from 'class-validator';
import { AuthGuard } from '../common/guards/auth.guard';
import { FeatureGuard,RequireFeature } from '../common/guards/feature.guard';
import { PlatformAuthGuard } from '../platform/auth/platform-auth.guard';
import { AssistantService } from './assistant.service';
import { Language } from './assistant.types';
import { AssistantCatalogService } from './assistant-catalog.service';
import { AssistantAnalyticsService } from './assistant-analytics.service';
class AskDto { @IsString() @MinLength(1) @MaxLength(400) message:string; @IsOptional() @IsUUID() session_id?:string; @IsOptional() @IsInt() @Min(0) session_version?:number; @IsOptional() @IsIn(['en','hi','hinglish']) language?:Language; @IsOptional() @IsIn(['TEXT','VOICE']) channel?:'TEXT'|'VOICE'; }
class ExampleDto { @IsString() @MinLength(3) @MaxLength(400) phrase:string; @IsString() @MaxLength(60) intent_code:string; @IsIn(['en','hi','hinglish']) language:string; }
class ActiveDto { @IsBoolean() active:boolean; }
class CatalogFilterDto { @IsOptional() @IsString() @MaxLength(60) intent?:string; @IsOptional() @IsIn(['en','hi','hinglish']) language?:string; @IsOptional() @IsIn(['DEFAULT','ADMIN_ADDED','UNKNOWN_MAPPED']) source?:string; @IsOptional() @IsIn(['ACTIVE','INACTIVE']) status?:string; @IsOptional() @IsString() @MaxLength(100) search?:string; @IsOptional() @IsString() @MaxLength(8) offset?:string; }
@Controller('assistant')
@UseGuards(AuthGuard,FeatureGuard)
@RequireFeature('RETAIL_POS','ASSISTANT_TEXT')
export class AssistantController {
  constructor(private service:AssistantService){}
  @Post('query') ask(@Req() req:any,@Body() dto:AskDto){return this.service.query(req.user,dto);}
}
@Controller('platform/assistant')
@UseGuards(PlatformAuthGuard)
export class PlatformAssistantController {
  constructor(private catalog:AssistantCatalogService,private analytics:AssistantAnalyticsService){}
  @Get('analytics') stats(){return this.analytics.summary();}
  @Get('intents') intents(){return this.catalog.intents();}
  @Get('examples') examples(@Query() query:CatalogFilterDto){return this.catalog.examples(query);}
  @Post('examples') add(@Req() req:any,@Body() dto:ExampleDto){return this.catalog.add(req.user.sub,dto);}
  @Post('unknown/map') map(@Req() req:any,@Body() dto:ExampleDto){return this.analytics.map(req.user.sub,dto);}
  @Get('unknown') unknown(@Query() query:CatalogFilterDto){return this.analytics.unknown(query);}
  @Patch('intents/:code') active(@Req() req:any,@Param('code') code:string,@Body() dto:ActiveDto){return this.catalog.active(req.user.sub,code,dto.active);}
  @Post('examples/:id/retire') retire(@Req() req:any,@Param('id',ParseUUIDPipe) id:string){return this.catalog.retire(req.user.sub,id);}
}
