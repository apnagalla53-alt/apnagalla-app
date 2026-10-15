import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export interface OcrProvider {
  extractDocument(
    bytes: Buffer,
    stage: (label: string) => Promise<void>,
  ): Promise<{ text: string; confidence: number }>;
}
/** Runs exclusively in the separate intake worker, never in an HTTP handler.
 * Apache-2.0 Tesseract/WASM performs recognition locally. Model downloads contain no documents. */
export class TesseractOcrProvider implements OcrProvider {
  async extractDocument(
    bytes: Buffer,
    stage: (label: string) => Promise<void>,
  ) {
    await stage('Preparing the photo');
    const input = await sharp(bytes, { limitInputPixels: 20_000_000 })
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
    const cachePath = resolve(process.env.INTAKE_OCR_CACHE || '.ocr-cache');
    await mkdir(cachePath, { recursive: true });
    await stage('Loading the bill reader');
    let expired = false,
      initializationTimer: ReturnType<typeof setTimeout> | undefined;
    const initializing = createWorker(
      process.env.INTAKE_OCR_LANGUAGES || 'eng+hin',
      1,
      {
        cachePath,
        ...(process.env.INTAKE_OCR_LANG_PATH
          ? { langPath: process.env.INTAKE_OCR_LANG_PATH }
          : {}),
        logger: () => {},
        errorHandler: () => {},
      },
    );
    // If a model download finishes after timeout, release that late worker as well.
    void initializing
      .then((worker) => {
        if (expired) void worker.terminate();
      })
      .catch(() => {});
    let worker: Awaited<typeof initializing>;
    try {
      worker = await Promise.race([
        initializing,
        new Promise<never>((_, reject) => {
          initializationTimer = setTimeout(() => {
            expired = true;
            reject(new Error('Bill reader initialization timeout'));
          }, 60000);
        }),
      ]);
    } finally {
      if (initializationTimer) clearTimeout(initializationTimer);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await stage('Reading text');
      await worker.setParameters({ preserve_interword_spaces: '1' });
      const result = await Promise.race([
        worker.recognize(input),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Recognition timeout')),
            120000,
          );
        }),
      ]);
      if (result.data.text.length > 100000) throw Error('Document text limit');
      return { text: result.data.text, confidence: result.data.confidence };
    } finally {
      if (timer) clearTimeout(timer);
      await worker.terminate();
    }
  }
}
