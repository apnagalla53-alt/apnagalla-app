import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorageService } from './cloudinary-storage.service';
import { validateEnvironment } from '../../common/environment';

const key = '11111111-1111-4111-8111-111111111111/ITEM_IMAGE/22222222-2222-4222-8222-222222222222.png';
const publicId = 'apna-galla/' + key;
describe('Private Cloudinary attachment storage', () => {
  let service: CloudinaryStorageService;
  beforeEach(() => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'disposable-cloud');
    vi.stubEnv('CLOUDINARY_API_KEY', 'unit-test-key');
    vi.stubEnv('CLOUDINARY_API_SECRET', 'unit-test-secret');
    service = new CloudinaryStorageService();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('uploads only signed authenticated raw assets without exposing filenames or URLs', async () => {
    const upload = vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options: any, callback: any) => {
      const stream = new PassThrough();
      stream.on('finish', () => callback(null, { public_id: options.public_id, type: options.type, resource_type: options.resource_type }));
      return stream as any;
    });
    await service.save(key, Buffer.from('cleaned photo'));
    expect(upload.mock.calls[0][0]).toMatchObject({ public_id: publicId, resource_type: 'raw', type: 'authenticated', overwrite: false, secure: true, timeout: 30000 });
  });
  it('rejects traversal or remote URLs before contacting the provider', async () => {
    const destroy = vi.spyOn(cloudinary.uploader, 'destroy');
    for (const invalid of ['../../photo.jpg', 'https://evil.invalid/a.png', key + '?override=1']) await expect(service.delete(invalid)).rejects.toThrow('Invalid storage key');
    expect(destroy).not.toHaveBeenCalled();
  });
  it('rejects oversized uploads before contacting Cloudinary', async () => {
    const upload = vi.spyOn(cloudinary.uploader, 'upload_stream');
    await expect(service.save(key, Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toThrow('5 MB');
    expect(upload).not.toHaveBeenCalled();
  });
  it('downloads through a short-lived signed API URL, with no redirects', async () => {
    const signing = vi.spyOn(cloudinary.utils, 'private_download_url');
    const fetchMock = vi.fn().mockResolvedValue(new Response('private photo'));
    vi.stubGlobal('fetch', fetchMock);
    expect((await service.get(key)).toString()).toBe('private photo');
    expect(signing.mock.calls[0][0]).toBe(publicId);
    expect(signing.mock.calls[0][2]).toMatchObject({ type: 'authenticated', resource_type: 'raw' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.origin).toBe('https://api.cloudinary.com');
    expect(options.redirect).toBe('error');
    expect(Number(url.searchParams.get('expires_at')) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(60);
  });
  it('rejects unexpected signed URL hosts without fetching them', async () => {
    vi.spyOn(cloudinary.utils, 'private_download_url').mockReturnValue('https://evil.invalid/secret');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(service.get(key)).rejects.toThrow('Attachment storage is unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('bounds streamed downloads even when content length is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.alloc(5 * 1024 * 1024 + 1))));
    await expect(service.get(key)).rejects.toThrow('Attachment storage is unavailable');
  });
  it('hides provider errors and signed secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('https://api.cloudinary.com/?signature=secret')));
    await expect(service.get(key)).rejects.toThrow(/^Attachment storage is unavailable$/);
  });
  it('accepts idempotent deletes and refuses unknown delete results', async () => {
    const destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'not found' });
    await service.delete(key);
    expect(destroy.mock.calls[0][1]).toMatchObject({ resource_type: 'raw', type: 'authenticated', invalidate: true });
    destroy.mockResolvedValue({ result: 'failed' });
    await expect(service.delete(key)).rejects.toThrow('Attachment storage is unavailable');
  });
  it('fails closed for missing configuration and invalid cloud names', async () => {
    vi.stubEnv('CLOUDINARY_API_SECRET', '');
    await expect(service.save(key, Buffer.from('photo'))).rejects.toThrow('not configured');
    const config = { DATABASE_URL: 'postgresql://localhost/disposable_test', STORAGE_PROVIDER: 'cloudinary', CLOUDINARY_CLOUD_NAME: 'valid', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' };
    expect(validateEnvironment(config).STORAGE_PROVIDER).toBe('cloudinary');
    expect(() => validateEnvironment({ ...config, CLOUDINARY_API_SECRET: '' })).toThrow('CLOUDINARY_API_SECRET');
    expect(() => validateEnvironment({ ...config, CLOUDINARY_CLOUD_NAME: '../redirect' })).toThrow('Invalid Cloudinary cloud name');
  });
});
