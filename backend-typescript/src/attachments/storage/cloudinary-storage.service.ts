import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { StorageService } from './storage.interface';

const MAX_BYTES = 5 * 1024 * 1024;

/** Opaque, authenticated raw assets preserve the already sanitized photo bytes.
 * Signed download URLs stay inside the API, after its tenant authorization. */
@Injectable()
export class CloudinaryStorageService implements StorageService {
  private options() {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud_name || !api_key || !api_secret) throw new ServiceUnavailableException('Private photo storage is not configured');
    return { cloud_name, api_key, api_secret, secure: true, resource_type: 'raw' as const, type: 'authenticated', timeout: 30000 };
  }

  private publicId(key: string) {
    if (!/^[a-f0-9-]{36}\/[A-Z_]+\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) throw new BadRequestException('Invalid storage key');
    return `apna-galla/${key}`;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const public_id = this.publicId(key), options = this.options();
    if (!Buffer.isBuffer(data) || !data.length || data.length > MAX_BYTES) throw new BadRequestException('Photo must contain 1 byte to 5 MB');
    try {
      await new Promise<void>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ ...options, public_id, overwrite: false }, (error, result) => {
          if (error || !result || result.public_id !== public_id || result.type !== 'authenticated' || result.resource_type !== 'raw') reject(new Error('Private storage upload failed'));
          else resolve();
        });
        stream.on('error', reject);
        stream.end(data);
      });
    } catch { throw new ServiceUnavailableException('Private photo storage is unavailable'); }
  }

  async get(key: string): Promise<Buffer> {
    const publicId = this.publicId(key), options = this.options();
    try {
      const signed = cloudinary.utils.private_download_url(publicId, '', {
        ...options, attachment: false, expires_at: Math.floor(Date.now() / 1000) + 60,
      });
      const url = new URL(signed);
      // Never follow a provider redirect, accept an arbitrary remote URL, or log this signed URL.
      if (url.protocol !== 'https:' || url.hostname !== 'api.cloudinary.com' || url.port || url.username || url.password || url.pathname !== `/v1_1/${options.cloud_name}/raw/download`) throw new Error('Unexpected storage endpoint');
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > MAX_BYTES) {
        await response.body?.cancel();
        throw new Error('Private storage download failed');
      }
      const reader = response.body.getReader(), parts: Buffer[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) throw new Error('Storage download exceeds photo limit');
          parts.push(Buffer.from(value));
        }
      } finally { await reader.cancel(); }
      if (!size) throw new Error('Empty storage asset');
      return Buffer.concat(parts, size);
    } catch { throw new ServiceUnavailableException('Attachment storage is unavailable'); }
  }

  async delete(key: string): Promise<void> {
    const publicId = this.publicId(key), options = this.options();
    try {
      const result = await cloudinary.uploader.destroy(publicId, { ...options, invalidate: true });
      if (!['ok', 'not found'].includes(result.result)) throw new Error('Storage delete failed');
    } catch { throw new ServiceUnavailableException('Attachment storage is unavailable'); }
  }
}
