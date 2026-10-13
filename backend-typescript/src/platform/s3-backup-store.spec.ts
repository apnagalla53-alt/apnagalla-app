import { S3BackupStore } from './s3-backup-store';
import { GetObjectCommand, HeadBucketCommand, GetBucketLifecycleConfigurationCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes, randomUUID } from 'crypto';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Offsite backup encryption and integrity (provider transport simulated)', () => {
  let directory: string, store: S3BackupStore, payload: Buffer, uploaded: any;
  const key = randomUUID() + '.dump', plaintext = Buffer.from('Disposable pg_dump binary stand-in with private marker');
  const previous: Record<string,string|undefined> = {};
  beforeAll(async () => {
    for (const name of ['BACKUP_ENCRYPTION_KEY','BACKUP_S3_BUCKET','BACKUP_S3_REGION','BACKUP_RETENTION_DAYS','BACKUP_S3_PREFIX']) previous[name] = process.env[name];
    Object.assign(process.env, { BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('base64'), BACKUP_S3_BUCKET: 'disposable-unit-bucket', BACKUP_S3_REGION: 'ap-south-1', BACKUP_RETENTION_DAYS: '30', BACKUP_S3_PREFIX: 'evolix-backups/' });
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'evolix-backup-unit-'));
    store = new S3BackupStore();
    (store as any).client = { send: async (command: any) => {
      if (command instanceof HeadBucketCommand) return {};
      if (command instanceof GetBucketLifecycleConfigurationCommand) return {Rules:[{Status:'Enabled',Filter:{Prefix:'evolix-backups/'},Expiration:{Days:30}}]};
      if (command instanceof PutObjectCommand) { uploaded=command.input; const chunks:Buffer[]=[];for await(const chunk of command.input.Body as any)chunks.push(chunk);payload=Buffer.concat(chunks);return {}; }
      if (command instanceof GetObjectCommand) return {Body:Readable.from(payload)};
      throw new Error('Unexpected provider command');
    }};
    await fs.writeFile(path.join(directory,key), plaintext);
  });
  afterAll(async () => {
    for (const [name,value] of Object.entries(previous)) {if(value===undefined)delete process.env[name];else process.env[name]=value;}
    const target=path.resolve(directory),parent=path.resolve(os.tmpdir());
    if(path.dirname(target)!==parent||!path.basename(target).startsWith('evolix-backup-unit-'))throw new Error('Unexpected test cleanup path');
    await fs.rm(target,{recursive:true,force:true});
  });
  it('requires a verified configured retention policy',async()=>{
    expect((await store.availability()).retention_verified).toBe(true);
    const old=(store as any).client;(store as any).client={send:async()=>({Rules:[]})};
    try{await expect(store.availability()).rejects.toThrow('retention');}finally{(store as any).client=old;}
  });
  it('uploads authenticated ciphertext with private provider encryption',async()=>{
    await store.upload(key,path.join(directory,key));expect(payload.includes(plaintext)).toBe(false);expect(payload.subarray(0,5).toString()).toBe('EVB01');expect(uploaded.ServerSideEncryption).toBe('AES256');expect(uploaded.Key).toBe('evolix-backups/'+key+'.enc');expect(await fs.stat(path.join(directory,key+'.enc')).catch(()=>null)).toBeNull();
  });
  it('recovers exactly the original bytes before exposing an archive path',async()=>{
    const recovered=await store.download(key,directory);expect(await fs.readFile(recovered)).toEqual(plaintext);
  });
  it('rejects tampering and removes unauthenticated plaintext',async()=>{
    const original=Buffer.from(payload);payload[20]^=1;
    try{await expect(store.download(key,directory)).rejects.toThrow('authentication');expect(await fs.stat(path.join(directory,key)).catch(()=>null)).toBeNull();}finally{payload=original;}
  });
  it('binds ciphertext to its archive identity and rejects a wrong key',async()=>{
    await expect(store.download(randomUUID()+'.dump',directory)).rejects.toThrow('authentication');
    const original=process.env.BACKUP_ENCRYPTION_KEY;process.env.BACKUP_ENCRYPTION_KEY=randomBytes(32).toString('base64');
    try{await expect(store.download(key,directory)).rejects.toThrow('authentication');}finally{process.env.BACKUP_ENCRYPTION_KEY=original;}
  });
  it('rejects truncated archives and traversal identities',async()=>{
    const original=payload;payload=Buffer.from('EVB01');try{await expect(store.download(key,directory)).rejects.toThrow('authentication');}finally{payload=original;}
    await expect(store.upload('../outside.dump',path.join(directory,key))).rejects.toThrow();
    await expect(store.download('../outside.dump',directory)).rejects.toThrow('Invalid archive identity');
  });
});
