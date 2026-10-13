import { Injectable, InternalServerErrorException, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.interface';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'storage');
    this.ensureDirSync(this.uploadDir);
  }

  private ensureDirSync(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  private file(key:string) {
    if(!/^[a-f0-9-]{36}\/[A-Z_]+\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))throw new BadRequestException('Invalid storage key');
    const root=path.resolve(this.uploadDir),file=path.resolve(root,key);
    if(!file.startsWith(root+path.sep))throw new BadRequestException('Invalid storage location');
    return file;
  }

  async save(key: string, data: Buffer): Promise<void> {
    try {
      const filePath = this.file(key);
      const dir = path.dirname(filePath);
      this.ensureDirSync(dir);
      await fs.promises.writeFile(filePath, data);
    } catch (err) {
      this.logger.error(JSON.stringify({event:'private_file_save_failed',code:/^[A-Z0-9_]{1,30}$/.test((err as NodeJS.ErrnoException).code||'')?(err as NodeJS.ErrnoException).code:'UNKNOWN'}));
      throw new InternalServerErrorException('Failed to save file');
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      const filePath = this.file(key);
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('File not found in storage');
      }
      return await fs.promises.readFile(filePath);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(JSON.stringify({event:'private_file_read_failed',code:/^[A-Z0-9_]{1,30}$/.test((err as NodeJS.ErrnoException).code||'')?(err as NodeJS.ErrnoException).code:'UNKNOWN'}));
      throw new InternalServerErrorException('Failed to read file');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.file(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      if((err as NodeJS.ErrnoException).code==='ENOENT')return;
      this.logger.error(JSON.stringify({event:'private_file_delete_failed',code:(err as NodeJS.ErrnoException).code||'UNKNOWN'}));
      throw new InternalServerErrorException('Private file deletion failed. Retry before removing its database record.');
    }
  }
}
