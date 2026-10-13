import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { S3BackupStore } from './s3-backup-store';
import { PrismaService } from '../database/prisma.service';
import { PlatformService } from './platform.service';
import { IsString, MinLength, MaxLength } from 'class-validator';

const run = promisify(execFile);
export class RestoreBackupDto {
  @IsString() @MinLength(1) @MaxLength(63) target_database: string;
  @IsString() @MinLength(3) @MaxLength(2000) reason: string;
  @IsString() @MaxLength(100) confirmation: string;
}

/** Provider operations never accept command text, SQL, storage paths or credentials from the browser. */
@Injectable()
export class BackupProvider {
  private directory = path.resolve(process.env.BACKUP_DIRECTORY || path.join(process.cwd(), '.local-backups'));

  private connection(database?: string) {
    const url = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && process.env.BACKUP_PROVIDER !== 's3') throw new ServiceUnavailableException('Remote backups require the encrypted offsite provider');
    return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: database || decodeURIComponent(url.pathname.slice(1)),
        PGOPTIONS:'-c app.security_scope=system',
      PGSSLMODE: url.searchParams.get('sslmode') || (['localhost', '127.0.0.1'].includes(url.hostname) ? 'prefer' : 'verify-full') };
  }
  async executable(name: 'pg_dump' | 'pg_restore') {
    const configured = process.env[name === 'pg_dump' ? 'PG_DUMP_PATH' : 'PG_RESTORE_PATH'];
    if (configured) return configured;
    const root = 'C:/Program Files/PostgreSQL';
    try {
      const versions = (await fs.readdir(root)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const version of versions) {
        const candidate = path.join(root, version, 'bin', `${name}.exe`);
        try { await fs.access(candidate); return candidate; } catch {}
      }
    } catch {}
    return name;
  }
  async availability() {
    if(process.env.BACKUP_PROVIDER==='none'||process.env.NODE_ENV==='production'&&!['local','s3'].includes(process.env.BACKUP_PROVIDER||''))return {status:'NOT_CONFIGURED',provider:'none',reason:'Production backup provider is not configured'};
    try {
      const dump = await this.executable('pg_dump'); const restore = await this.executable('pg_restore');
      const [a, b] = await Promise.all([run(dump, ['--version']), run(restore, ['--version'])]);
      this.connection();
      if(process.env.BACKUP_PROVIDER==='s3')return {status:'AVAILABLE',provider:'Encrypted offsite S3 PostgreSQL archive',tool_version:a.stdout.trim(),...await new S3BackupStore().availability()};
      return { status: 'AVAILABLE', provider: 'Local PostgreSQL custom archive', tool_version: a.stdout.trim(), verifier_version: b.stdout.trim(),
        restore_target: process.env.BACKUP_RESTORE_DATABASE || null, selective_tenant_restore: 'UNAVAILABLE', production_pitr: 'UNAVAILABLE' };
    } catch { return { status: 'UNAVAILABLE', reason: 'Configure local PostgreSQL tools and database connection. Cloud/PITR adapter is not configured.' }; }
  }
  async create(database?: string) {
    if(process.env.BACKUP_PROVIDER==='none')throw new ServiceUnavailableException('Backup provider is not configured');
    if(process.env.NODE_ENV==='production'&&process.env.BACKUP_PROVIDER!=='s3')throw new ServiceUnavailableException('Production requires encrypted offsite backups');
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await fs.chmod(this.directory, 0o700);
    const storageKey = `${randomUUID()}.dump`;
    const file = this.file(storageKey);
    try {
      const handle = await fs.open(file, 'wx', 0o600); await handle.close();
      await run(await this.executable('pg_dump'), ['--format=custom', '--enable-row-security', '--inserts', '--no-owner', '--no-acl', '--file', file],
        { env: this.connection(database), timeout: 120_000, maxBuffer: 1024 * 1024, windowsHide: true });
      const size=(await fs.stat(file)).size;
      if(process.env.BACKUP_PROVIDER==='s3') { const store=new S3BackupStore();await store.availability();await store.upload(storageKey,file);await fs.rm(file,{force:true}); }
      return { storageKey:process.env.BACKUP_PROVIDER==='s3'?'s3:'+storageKey:storageKey, size };
    } catch { await fs.rm(file,{force:true});throw new ServiceUnavailableException('Database backup failed. Check PostgreSQL tools, offsite provider, encryption and retention configuration.'); }
  }
  private file(key: string) {
    if (!/^[a-f0-9-]{36}\.dump$/.test(key)) throw new BadRequestException('Invalid backup storage key');
    const file = path.resolve(this.directory, key);
    if (path.dirname(file) !== this.directory) throw new BadRequestException('Invalid backup location');
    return file;
  }
  async verify(key: string) {
    await fs.mkdir(this.directory,{recursive:true});
    const offsite=key.startsWith('s3:');if(offsite)key=key.slice(3);
    const temporary=offsite?await fs.mkdtemp(path.join(this.directory,'verify-')):null;
    try {
      const file=temporary?await new S3BackupStore().download(key,temporary):this.file(key);
      const result = await run(await this.executable('pg_restore'), ['--list', file], { timeout: 30_000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
      if (!result.stdout.includes('TABLE')) throw new Error('Empty archive');
      return { archive_entries: result.stdout.split('\n').filter(l => l && !l.startsWith(';')).length,
        verification: 'PostgreSQL archive structure verified; restore verification is a separate operation.' };
    } catch { throw new BadRequestException('Backup archive could not be verified'); }
    finally {if(temporary)await this.removeTemporary(temporary);}
  }
  private async removeTemporary(directory:string) {
    if(path.dirname(path.resolve(directory))!==this.directory||!path.basename(directory).startsWith('verify-'))throw new BadRequestException('Invalid temporary backup directory');
    await fs.rm(directory,{recursive:true,force:true});
  }
  async restore(key: string, target: string) {
    if (process.env.NODE_ENV === 'production' || target !== process.env.BACKUP_RESTORE_DATABASE || !/^[a-z][a-z0-9_]*_restore_test$/.test(target)) {
      throw new BadRequestException('Restore requires a configured, pre-created local database ending in _restore_test. Production restore adapter is unavailable.');
    }
    const current = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    if (current === target) throw new BadRequestException('Cannot restore over the running ERP database');
    await fs.mkdir(this.directory,{recursive:true});
    const offsite=key.startsWith('s3:');if(offsite)key=key.slice(3);
    const temporary=offsite?await fs.mkdtemp(path.join(this.directory,'verify-')):null;
    try {
      const file=temporary?await new S3BackupStore().download(key,temporary):this.file(key);
      await run(await this.executable('pg_restore'), ['--exit-on-error', '--enable-row-security', '--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', target, file],
        { env: this.connection(target), timeout: 120_000, maxBuffer: 1024 * 1024, windowsHide: true });
    } catch { throw new ServiceUnavailableException('Restore failed. Target must exist and PostgreSQL access must be configured.'); }
    finally {if(temporary)await this.removeTemporary(temporary);}
  }
}

@Injectable()
export class PlatformBackupService {
  constructor(private prisma: PrismaService, private platform: PlatformService, private provider: BackupProvider) {}
  private public(row: any) {
    const { storage_key, size_bytes, ...safe } = row;
    return { ...safe, size_bytes: Number(size_bytes), location: storage_key.startsWith('s3:')?'Private encrypted offsite backup storage':'Configured private local backup storage' };
  }
  async list() { return { provider: await this.provider.availability(), backups: (await this.prisma.platformBackup.findMany({ orderBy: { created_at: 'desc' },take:200 })).map(r => this.public(r)) }; }
  async create(actor: string, type = 'MANUAL', database?: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'EVOLIX_BACKUP_CREATE'},0))`;
      if(['MANUAL','SCHEDULED'].includes(type)) {
        const recent=await tx.platformBackup.findFirst({where:{created_by:actor,type,status:{in:['CREATED','VERIFIED']},created_at:{gt:new Date(Date.now()-120_000)}},orderBy:{created_at:'desc'}});
        if(recent)return this.public(recent);
      }
      const file = await this.provider.create(database);
      const backup = await tx.platformBackup.create({ data: { environment: process.env.NODE_ENV || 'development', type, status: 'CREATED',
        storage_key: file.storageKey, size_bytes: file.size, created_by: actor } });
      await this.platform.audit(tx, actor, 'BACKUP_CREATE', 'PlatformBackup', backup.id, { type, target_database: database || 'current' });
      return this.public(backup);
    },{timeout:180_000,maxWait:10_000});
  }
  async verify(id: string, actor: string) {
    const backup = await this.prisma.platformBackup.findUnique({ where: { id } });
    if (!backup) throw new BadRequestException('Backup not found');
    const evidence = await this.provider.verify(backup.storage_key);
    return this.prisma.$transaction(async tx => {
      const result = await tx.platformBackup.update({ where: { id }, data: { verified_at: new Date(), status: 'VERIFIED' } });
      await this.platform.audit(tx, actor, 'BACKUP_VERIFY', 'PlatformBackup', id, evidence);
      return { ...this.public(result), ...evidence };
    });
  }
  async restore(id: string, dto: RestoreBackupDto, actor: string) {
    if (dto.confirmation !== `RESTORE ${dto.target_database}`) throw new BadRequestException('Type RESTORE followed by the target database name');
    if (dto.target_database !== process.env.BACKUP_RESTORE_DATABASE || !dto.target_database.endsWith('_restore_test') || process.env.NODE_ENV === 'production') throw new BadRequestException('A disposable local restore target must be configured');
    const backup = await this.prisma.platformBackup.findUnique({ where: { id } });
    if (!backup || !backup.verified_at) throw new BadRequestException('Verify the backup before restoring');
    const safetyBackup = await this.create(actor, 'PRE_RESTORE', dto.target_database);
    await this.prisma.$transaction(tx => this.platform.audit(tx, actor, 'BACKUP_RESTORE_START', 'PlatformBackup', id, { ...dto, safety_backup_id: safetyBackup.id }));
    try {
      await this.provider.restore(backup.storage_key, dto.target_database);
      await this.prisma.$transaction(tx => this.platform.audit(tx, actor, 'BACKUP_RESTORE_SUCCESS', 'PlatformBackup', id, dto));
      return { status: 'RESTORED', target_database: dto.target_database, safety_backup_id: safetyBackup.id };
    } catch (error) {
      await this.prisma.$transaction(tx => this.platform.audit(tx, actor, 'BACKUP_RESTORE_FAILED', 'PlatformBackup', id, dto));
      throw error;
    }
  }
}
