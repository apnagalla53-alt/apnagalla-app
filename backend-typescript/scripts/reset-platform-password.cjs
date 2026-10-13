// Operator recovery only. No password arguments, browser endpoints or default credentials.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const readline = require('node:readline/promises');
const db = new PrismaClient({ log: [] });

async function hiddenPassword(prompt) {
  if (!process.stdin.isTTY) throw new Error('Use a private interactive operator terminal');
  process.stdout.write(prompt); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = buffer => {
      for (const char of buffer.toString()) {
        if (char === '\u0003') { finish(); reject(new Error('Cancelled')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') { value = value.slice(0, -1); continue; }
        if (char.charCodeAt(0) >= 32) value += char;
      }
    };
    function finish() { process.stdin.removeListener('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); }
    process.stdin.on('data', onData);
  });
}

(async () => {
  if (process.argv.length > 2) throw new Error('Arguments are not supported. Enter credentials interactively.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  const username = (await terminal.question('Existing Super Admin username/email: ')).trim();
  const reason = (await terminal.question('Recovery reason (no secrets, 10–300 characters): ')).trim();
  const confirmation = await terminal.question('Type RESET PLATFORM PASSWORD FOR ' + username + ': '); terminal.close();
  if (!username || username.length > 255 || reason.length < 10 || reason.length > 300 || confirmation !== 'RESET PLATFORM PASSWORD FOR ' + username) throw new Error('Invalid recovery confirmation');
  const password = await hiddenPassword('New password (hidden, at least 16 characters): ');
  const repeated = await hiddenPassword('Repeat password: ');
  if (password !== repeated || password.length < 16 || Buffer.byteLength(password, 'utf8') > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new Error('Password policy failed');
  const hash = await bcrypt.hash(password, 12);
  await db.$transaction(async tx => {
    const user = await tx.platformUser.findUnique({ where: { username }, include: { roles: { include: { role: true } } } });
    if (!user?.is_active || !user.roles.some(role => role.role.name === 'SUPER_ADMIN')) throw new Error('No active Super Admin matched');
    await tx.$queryRaw`SELECT id FROM platform_users WHERE id=${user.id}::uuid FOR UPDATE`;
    const current = await tx.platformUser.findUnique({ where: { id: user.id }, include: { roles: { include: { role: true } } } });
    if (!current?.is_active || !current.roles.some(role => role.role.name === 'SUPER_ADMIN')) throw new Error('No active Super Admin matched');
    if (await bcrypt.compare(password, current.password_hash)) throw new Error('Choose a different password');
    await tx.platformUser.update({ where: { id: user.id }, data: { password_hash: hash, failed_login_count: 0, is_locked: false } });
    await tx.platformSession.updateMany({ where: { user_id: user.id, revoked_at: null }, data: { revoked_at: new Date() } });
    await tx.platformMfaChallenge.updateMany({where:{user_id:user.id,used_at:null},data:{used_at:new Date()}});
    await tx.platformAuditLog.create({ data: { user_id: user.id, action: 'OPERATOR_PASSWORD_RECOVERY', resource_type: 'PlatformUser', resource_id: user.id, details: JSON.stringify({ method: 'Interactive operator CLI; subject is recovered account', reason }) } });
  }, { timeout: 30_000 });
  process.stdout.write('Platform password reset and active sessions revoked. Recovery was audited.\n');
})().catch(() => { process.stderr.write('Platform recovery failed. Verify operator access, exact active administrator identity, confirmation and password policy.\n'); process.exitCode = 1; })
  .finally(() => db.$disconnect());
