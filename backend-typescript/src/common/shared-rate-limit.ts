import { HttpException, ServiceUnavailableException } from '@nestjs/common';
type Consumer = (key: string, limit: number, windowMs: number) => Promise<void>;
let consumer: Consumer | null = null;
const testWindows = new Map<string, { count: number; expires: number }>();
export function setRateConsumer(next: Consumer | null) {
  consumer = next;
}
export async function consumeRate(
  key: string,
  limit: number,
  windowMs: number,
) {
  if (consumer) return consumer(key, limit, windowMs);
  if (process.env.NODE_ENV !== 'test')
    throw new ServiceUnavailableException(
      'Security rate limiting is unavailable.',
    );
  const now = Date.now();
  let record = testWindows.get(key);
  if (!record || record.expires <= now) {
    record = { count: 0, expires: now + windowMs };
    testWindows.set(key, record);
  }
  if (++record.count > limit)
    throw new HttpException(
      {
        message: 'Too many requests. Try again later.',
        retry_after_seconds: Math.ceil((record.expires - now) / 1000),
      },
      429,
    );
}
