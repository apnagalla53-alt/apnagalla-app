import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { LocalStorageService } from '../../attachments/storage/local-storage.service';
import { CloudinaryStorageService } from '../../attachments/storage/cloudinary-storage.service';
import { S3StorageService } from '../../attachments/storage/s3-storage.service';
import type { StorageService } from '../../attachments/storage/storage.interface';
import { TesseractOcrProvider } from './ocr-provider';
import {
  cleanExpiredIntakeDocuments,
  processNextIntakeDocument,
} from './intake-ocr-queue';
@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    PrismaService,
    LocalStorageService,
    CloudinaryStorageService,
    S3StorageService,
    {
      provide: 'StorageService',
      inject: [LocalStorageService, CloudinaryStorageService, S3StorageService],
      useFactory: (
        local: LocalStorageService,
        cloud: CloudinaryStorageService,
        s3: S3StorageService,
      ) =>
        process.env.STORAGE_PROVIDER === 'cloudinary'
          ? cloud
          : process.env.STORAGE_PROVIDER === 's3'
            ? s3
            : local,
    },
  ],
})
class IntakeWorkerModule {}
async function main() {
  const app = await NestFactory.createApplicationContext(IntakeWorkerModule, {
      logger: ['warn', 'error'],
    }),
    db = app.get(PrismaService),
    storage = app.get<StorageService>('StorageService'),
    provider = new TesseractOcrProvider();
  let running = true,
    lastCleanup = 0;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      running = false;
    });
  while (running) {
    try {
      if (Date.now() - lastCleanup > 3600000) {
        await cleanExpiredIntakeDocuments(db, storage);
        lastCleanup = Date.now();
      }
      const processed =
        process.env.INTAKE_OCR_ENABLED === 'true' &&
        (await processNextIntakeDocument(db, storage, provider));
      if (!processed) await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch {
      await new Promise((resolve) =>
        setTimeout(resolve, 10000),
      ); /* No source text, tenant names or credentials in worker logs. */
    }
  }
  await app.close();
}
void main().catch(() => {
  process.stderr.write(
    'Intake worker could not start. Check database and private storage configuration.\n',
  );
  process.exitCode = 1;
});
