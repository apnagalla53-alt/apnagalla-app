import { Module } from '@nestjs/common';
import { BarcodeService } from './barcode.service';
import { BarcodePrintService } from './barcode-print.service';
import { BarcodeController } from './barcode.controller';
import { PrismaModule } from '../database/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'evolix-super-secret-key',
    }),
  ],
  controllers: [BarcodeController],
  providers: [BarcodeService, BarcodePrintService],
  exports: [BarcodeService, BarcodePrintService],
})
export class BarcodeModule {}
