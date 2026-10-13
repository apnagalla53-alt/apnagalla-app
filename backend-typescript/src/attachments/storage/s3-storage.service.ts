import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from './storage.interface';
@Injectable()
export class S3StorageService implements StorageService {
  private client=new S3Client({region:process.env.S3_REGION,endpoint:process.env.S3_ENDPOINT||undefined,
    forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true'});
  async save(key:string,data:Buffer) {
    try{await this.client.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:data,
      ServerSideEncryption:process.env.S3_KMS_KEY_ID?'aws:kms':'AES256',SSEKMSKeyId:process.env.S3_KMS_KEY_ID||undefined}));}
    catch{throw new ServiceUnavailableException('Private object storage is unavailable');}
  }
  async get(key:string) {
    try{const result=await this.client.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));return Buffer.from(await result.Body!.transformToByteArray());}
    catch{throw new ServiceUnavailableException('Attachment storage is unavailable');}
  }
  async delete(key:string) {
    try{await this.client.send(new DeleteObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));}
    catch{throw new ServiceUnavailableException('Attachment storage is unavailable');}
  }
}
