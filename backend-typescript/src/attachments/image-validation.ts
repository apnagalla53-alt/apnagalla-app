import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
/** Decode the complete image, bound pixel work, remove metadata and extra bytes. */
export async function cleanUploadedImage(
  bytes: Buffer,
  mime: string,
): Promise<Buffer> {
  const format = (
    { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' } as const
  )[mime as 'image/jpeg'];
  if (!format) throw new BadRequestException('Use JPG, PNG or WebP.');
  try {
    const input = sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: 20_000_000,
      animated: false,
    });
    const metadata = await input.metadata();
    if (
      metadata.format !== format ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages || 1) > 1
    )
      throw Error('Unsupported image');
    const result = await input.rotate().toFormat(format).toBuffer();
    if (!result.length || result.length > 5 * 1024 * 1024)
      throw Error('Image too large');
    return result;
  } catch {
    throw new BadRequestException(
      'This photo is damaged or too large. Choose a valid JPG, PNG or WebP up to 5 MB and 20 million pixels.',
    );
  }
}
