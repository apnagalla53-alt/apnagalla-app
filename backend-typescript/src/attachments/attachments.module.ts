import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './storage/local-storage.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { S3StorageService } from './storage/s3-storage.service';
import { CloudinaryStorageService } from './storage/cloudinary-storage.service';
import { EntitlementService } from '../common/entitlement.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    EntitlementService,
    LocalStorageService,
    S3StorageService,
    CloudinaryStorageService,
    {
      provide: 'StorageService',
      inject: [LocalStorageService,S3StorageService,CloudinaryStorageService],
      useFactory: (local:LocalStorageService,s3:S3StorageService,cloudinary:CloudinaryStorageService) =>
        process.env.STORAGE_PROVIDER==='cloudinary'?cloudinary:process.env.STORAGE_PROVIDER==='s3'?s3:local,
    }
  ],
  exports: [AttachmentsService, LocalStorageService],
})
export class AttachmentsModule {}
