require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const target = process.argv[2];
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || process.env.NODE_ENV === 'production' || !/^evolix_[a-z0-9_]+_(test|restore_test)$/.test(target || '')) {
  throw new Error('Provide a new disposable local evolix_*_test database name. This script never drops or resets a database.');
}
url.pathname = '/postgres';
const client = new PrismaClient({ datasourceUrl: url.toString() });
(async () => {
  const found = await client.$queryRawUnsafe('SELECT 1 FROM pg_database WHERE datname=$1', target);
  if (found.length) throw new Error('Database already exists; refusing to alter it');
  await client.$executeRawUnsafe('CREATE DATABASE "' + target + '"');
  console.log('Created new disposable database ' + target);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => client.$disconnect());
