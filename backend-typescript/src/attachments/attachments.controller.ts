import { Controller, Post, Get, Delete, Param, Query, UseInterceptors, UploadedFile, Body, Req, UseGuards, BadRequestException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { Response } from 'express';
import { EntitlementService } from '../common/entitlement.service';

@Controller('attachments')
@UseGuards(AuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService,private entitlements:EntitlementService) {}
  @Get()
  list(@Req() req:any,@Query() query:any) { return this.attachmentsService.list(req.user.company_id,query); }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(file.mimetype)) {
        return cb(new BadRequestException('Unsupported file type. Only JPG, PNG, and WEBP are allowed.'), false);
      }
      cb(null, true);
    }
  }))
  async upload(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
    @Body('category') category: string
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!entityType || !entityId || !category) throw new BadRequestException('entityType, entityId, and category are required');
    if(entityType.toUpperCase()==='ITEM')await this.entitlements.require(req.user.organization_id,['ITEM_IMAGES'],req.user.company_id);

    const attachment = await this.attachmentsService.uploadAttachment(
      req.user.organization_id,
      req.user.company_id,
      req.user.branch_id,
      req.user.id,
      entityType,
      entityId,
      category,
      file
    );

    return {
      id: attachment.id,
      category: attachment.category,
      url: `/api/v1/attachments/${attachment.id}/content`,
      mimeType: attachment.mime_type,
      fileSize: attachment.file_size
    };
  }

  @Get(':id/content')
  async getContent(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { attachment, buffer } = await this.attachmentsService.getAttachment(req.user.company_id, id);
    res.set({
      'Content-Type': attachment.mime_type,
      'Content-Disposition': `inline; filename="${attachment.stored_file_name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': attachment.file_size
    });
    res.send(buffer);
  }

  @Delete(':id')
  async deleteAttachment(@Req() req: any, @Param('id') id: string) {
    const attachment=await this.attachmentsService.getMetadata(req.user.company_id,id);
    if(attachment.entity_type==='ITEM')await this.entitlements.require(req.user.organization_id,['ITEM_IMAGES'],req.user.company_id);
    await this.attachmentsService.deleteAttachment(req.user.company_id, id);
    return { success: true };
  }
}
