import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private db:PrismaService) {}
  @Get()
  check() {
    return { status: 'ok', version:process.env.APP_VERSION || 'development' };
  }
  @Get('ready')
  async ready() {
    try { await this.db.$queryRaw`SELECT 1`; return {status:'ready'}; }
    catch { throw new ServiceUnavailableException('Not ready'); }
  }
}
