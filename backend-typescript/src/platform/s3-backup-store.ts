import { S3Client, GetObjectCommand, HeadBucketCommand, GetBucketLifecycleConfigurationCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

/** Offsite encrypted archives. Key material is an operator secret, never part of an archive or API response. */
export class S3BackupStore {
  private client: S3Client;
  private bucket = process.env.BACKUP_S3_BUCKET!;
  private prefix = process.env.BACKUP_S3_PREFIX || 'evolix-backups/';
  constructor() {
    this.client = new S3Client({ region: process.env.BACKUP_S3_REGION,
      ...(process.env.BACKUP_S3_ENDPOINT ? { endpoint: process.env.BACKUP_S3_ENDPOINT, forcePathStyle: true } : {}) });
  }
  private key(key: string) {
    if (!/^[a-f0-9-]{36}\.dump$/.test(key)) throw new BadRequestException('Invalid archive identity');
    return this.prefix + key + '.enc';
  }
  private encryptionKey() {
    const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || '', 'base64');
    if (key.length !== 32) throw new ServiceUnavailableException('Backup encryption key is not configured');
    return key;
  }
  async availability() {
    this.encryptionKey();
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    const lifecycle = await this.client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: this.bucket }));
    const required = Number(process.env.BACKUP_RETENTION_DAYS || '30');
    const rule = lifecycle.Rules?.find(r => r.Status === 'Enabled' && r.Expiration?.Days === required &&
      (r.Prefix === this.prefix || r.Filter?.Prefix === this.prefix));
    if (!rule) throw new ServiceUnavailableException('Configure and verify the backup bucket lifecycle retention rule');
    return { encryption: 'AES-256-GCM client-side; private S3 storage', retention_days: required,
      retention_verified: true, selective_tenant_restore: 'UNAVAILABLE', production_pitr: 'UNAVAILABLE' };
  }
  async upload(key: string, archive: string) {
    const objectKey = this.key(key);
    const encrypted = archive + '.enc';
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    // AAD binds format + identity, preventing substitution of another otherwise valid archive.
    cipher.setAAD(Buffer.from('EVOLIX_BACKUP_V1:' + key));
    try {
      await fs.writeFile(encrypted, Buffer.concat([Buffer.from('EVB01'), iv]), { mode: 0o600 });
      await pipeline(createReadStream(archive), cipher, createWriteStream(encrypted, { flags: 'a' }));
      await fs.appendFile(encrypted, cipher.getAuthTag());
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: createReadStream(encrypted),
        ContentLength: (await fs.stat(encrypted)).size, ContentType: 'application/octet-stream',
        ServerSideEncryption: process.env.BACKUP_S3_KMS_KEY_ID ? 'aws:kms' : 'AES256',
        ...(process.env.BACKUP_S3_KMS_KEY_ID ? { SSEKMSKeyId: process.env.BACKUP_S3_KMS_KEY_ID } : {}) }));
    } finally { await fs.rm(encrypted, { force: true }); }
  }
  async download(key: string, directory: string) {
    const objectKey = this.key(key);
    // A fresh private directory is owned by this operation, not a path supplied by an API user.
    const encrypted = path.join(directory, 'archive.enc');
    const archive = path.join(directory, key);
    try {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      if (!object.Body) throw new Error('Archive missing');
      await pipeline(object.Body as any, createWriteStream(encrypted, { mode: 0o600 }));
      const size = (await fs.stat(encrypted)).size;
      if (size < 33) throw new Error('Archive truncated');
      const handle = await fs.open(encrypted, 'r');
      const header = Buffer.alloc(17), tag = Buffer.alloc(16);
      try { await handle.read(header, 0, 17, 0); await handle.read(tag, 0, 16, size - 16); }
      finally { await handle.close(); }
      if (header.subarray(0, 5).toString() !== 'EVB01') throw new Error('Unsupported format');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), header.subarray(5));
      decipher.setAAD(Buffer.from('EVOLIX_BACKUP_V1:' + key)); decipher.setAuthTag(tag);
      await pipeline(createReadStream(encrypted, { start: 17, end: size - 17 }), decipher, createWriteStream(archive, { mode: 0o600 }));
      // Authentication completes before pg_restore ever reads the plaintext file.
      return archive;
    } catch {
      await fs.rm(archive, { force: true });
      throw new ServiceUnavailableException('Encrypted backup download or authentication failed');
    } finally { await fs.rm(encrypted, { force: true }); }
  }
}
