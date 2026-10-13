import { Body, Controller, Get, Post, Param, ParseUUIDPipe, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsBoolean } from 'class-validator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../../common/guards/feature.guard';
import { RetailImportService } from './import.service';
class CommitDto { @IsBoolean() accept_unmapped:boolean; }
@Controller('api/v1/retail/imports')
@UseGuards(AuthGuard,SubscriptionGuard,FeatureGuard)
@RequireFeature('RETAIL_POS')
export class RetailImportController {
  constructor(private imports:RetailImportService){}
  @Get('presets') presets(@Req() req:any){return this.imports.presets(req.user);}
  @Get() history(@Req() req:any){return this.imports.history(req.user);}
  @Post('preview')
  @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:10,fieldSize:30000}}))
  preview(@Req() req:any,@UploadedFile() file:Express.Multer.File,@Body() body:any){return this.imports.preview(req.user,file,body);}
  @Get(':id') job(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Query('page') page:string){return this.imports.job(req.user,id,Number(page));}
  @Post(':id/commit') commit(@Req() req:any,@Param('id',ParseUUIDPipe) id:string,@Body() body:CommitDto){return this.imports.commit(req.user,id,body.accept_unmapped);}
}
