import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import {
  FeatureGuard,
  RequireFeature,
} from '../../common/guards/feature.guard';
import { RetailIntakeService } from './intake.service';
import {
  ConfirmIntakeDto,
  ConfirmRowsDto,
  EditIntakeRowDto,
  IntakeMappingDto,
  VoiceIntakeDto,
} from './intake.dto';
const upload = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 16000 },
};
@Controller('api/v1/retail/account/intake')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard)
@RequireFeature('RETAIL_POS', 'INVENTORY')
export class RetailIntakeController {
  constructor(private intake: RetailIntakeService) {}
  @Get('capabilities') capabilities(@Req() req: any) {
    return this.intake.capabilities(req.user);
  }
  @Get() history(@Req() req: any) {
    return this.intake.history(req.user);
  }
  @Post('voice') voice(@Req() req: any, @Body() dto: VoiceIntakeDto) {
    return this.intake.voice(req.user, dto.transcript);
  }
  @Post('spreadsheet')
  @UseInterceptors(FileInterceptor('file', upload))
  spreadsheet(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.intake.spreadsheet(req.user, file, body);
  }
  @Post('photo') @UseInterceptors(FileInterceptor('file', upload)) photo(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.intake.photo(req.user, file, body.source === 'SHARED_DOCUMENT');
  }
  @Get(':id') job(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: string,
  ) {
    return this.intake.job(req.user, id, Number(page));
  }
  @Get(':id/photo') async document(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: any,
  ) {
    const photo = await this.intake.document(req.user, id);
    res.set({
      'Content-Type': photo.mime,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(photo.bytes);
  }
  @Patch(':id/rows/:row') edit(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('row', ParseUUIDPipe) row: string,
    @Body() dto: EditIntakeRowDto,
  ) {
    return this.intake.edit(req.user, id, row, dto);
  }
  @Post(':id/check-rows') check(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRowsDto,
  ) {
    return this.intake.confirmRows(req.user, id, dto.row_ids);
  }
  @Post(':id/mapping') mapping(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IntakeMappingDto,
  ) {
    return this.intake.remap(req.user, id, dto.mapping);
  }
  @Post(':id/confirm') confirm(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmIntakeDto,
  ) {
    return this.intake.confirm(req.user, id, dto);
  }
  @Post(':id/retry') retry(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.intake.retry(req.user, id);
  }
  @Post(':id/cancel') cancel(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.intake.cancel(req.user, id);
  }
}
