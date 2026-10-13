import { beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
// Existing suites test non-MFA features. Dedicated remediation tests explicitly
// enable MFA and exercise the full protocol; production cannot disable it.
if (process.env.NODE_ENV === 'test')
  process.env.PLATFORM_MFA_REQUIRED = 'false';
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !url.pathname.endsWith('_test')
  )
    throw Error('Isolated local test database required');
  const db = new PrismaClient();
  try {
    await db.securityRateWindow.deleteMany();
  } finally {
    await db.$disconnect();
  }
});
