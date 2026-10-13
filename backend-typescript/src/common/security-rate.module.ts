import {
  Global,
  Injectable,
  Module,
  OnModuleInit,
  OnModuleDestroy,
  HttpException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { setRateConsumer } from './shared-rate-limit';
@Injectable()
export class SecurityRateStore implements OnModuleInit, OnModuleDestroy {
  private housekeeping: ReturnType<typeof setInterval> | undefined;
  constructor(private db: PrismaService) {}
  async consume(scope: string, limit: number, windowMs: number) {
    const now = Date.now(),
      bucket = Math.floor(now / windowMs),
      expires = new Date((bucket + 1) * windowMs);
    const key = createHash('sha256')
      .update(scope + ':' + bucket + ':' + windowMs)
      .digest('hex');
    const [record] = await this.db.securitySystemQuery<{ count: number }[]>`
   INSERT INTO security_rate_windows(key,count,expires_at) VALUES (${key},1,${expires})
   ON CONFLICT (key) DO UPDATE SET count=LEAST(security_rate_windows.count+1,${limit + 1}) RETURNING count`;
    if (record.count > limit)
      throw new HttpException(
        {
          message: 'Too many requests. Try again later.',
          retry_after_seconds: Math.max(
            1,
            Math.ceil((expires.getTime() - now) / 1000),
          ),
        },
        429,
      );
  }
  async onModuleInit() {
    await this.db
      .securitySystemQuery`SELECT key FROM security_rate_windows LIMIT 1`;
    setRateConsumer((key, limit, windowMs) =>
      this.consume(key, limit, windowMs),
    );
    this.housekeeping = setInterval(
      () =>
        void this.db
          .securitySystemQuery`DELETE FROM security_rate_windows WHERE expires_at<NOW()`.catch(
          () => {},
        ),
      300000,
    );
    this.housekeeping.unref();
  }
  onModuleDestroy() {
    if (this.housekeeping) clearInterval(this.housekeeping);
    setRateConsumer(null);
  }
}
@Global()
@Module({ providers: [SecurityRateStore], exports: [SecurityRateStore] })
export class SecurityRateModule {}
