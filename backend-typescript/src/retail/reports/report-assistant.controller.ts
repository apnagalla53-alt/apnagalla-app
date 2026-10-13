import { Body,Controller,Get,Post,Param,ParseUUIDPipe,Req,UseGuards } from '@nestjs/common';
import { IsBoolean,IsIn,IsOptional,IsString,Matches,MaxLength,MinLength } from 'class-validator';
import { AuthGuard,RequirePermissions } from '../../common/guards/auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { FeatureGuard,RequireFeature } from '../../common/guards/feature.guard';
import { ReportAssistantService } from './report-assistant.service';
class QueryDto {@IsString() @MinLength(2) @MaxLength(500) query:string; @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?:string; @IsOptional() @IsIn(['hi','en']) language?:string;}
class PreferenceDto {@IsBoolean() enabled:boolean; @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) time:string; @IsIn(['hi','en']) language:string;}
@Controller('api/v1/retail/reports/assistant')
@UseGuards(AuthGuard,SubscriptionGuard,FeatureGuard)
@RequireFeature('RETAIL_POS')
@RequirePermissions('reports.read')
export class ReportAssistantController {
  constructor(private service:ReportAssistantService){}
  @Post('query') query(@Req() req:any,@Body() dto:QueryDto){return this.service.answer(req.user,dto.query,dto.date,dto.language);}
  @Get('preference') preference(@Req() req:any){return this.service.preference(req.user);}
  @Post('preference') save(@Req() req:any,@Body() dto:PreferenceDto){return this.service.savePreference(req.user,dto);}
  @Get('notifications') inbox(@Req() req:any){return this.service.inbox(req.user);}
  @Post('notifications/:id/read') read(@Req() req:any,@Param('id',ParseUUIDPipe) id:string){return this.service.read(req.user,id);}
}
