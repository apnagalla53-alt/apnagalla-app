import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

describe('Attachment Storage (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let compAId: string;
  let compBId: string;
  let branchId: string;
  let tokenA: string;
  let tokenB: string;
  let needId: string;
  let imageDirectory: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    
    prisma = app.get(PrismaService);
    
    const suffix=uuidv4(), password='Disposable!'+uuidv4();
    const plan=await prisma.plan.findUniqueOrThrow({where:{code:'SMART'}});
    const provision=(name:string)=>app.get(TenantProvisioningService).provisionTenant({organizationName:'TEST-ATT '+name+' '+suffix,adminName:'Test Attachment Owner',adminEmail:name+'-'+suffix+'@test.invalid',adminPassword:password,planId:plan.id});
    const A=await provision('a'), B=await provision('b');
    orgId=A.organization.id;compAId=A.company.id;compBId=B.company.id;branchId=A.branch.id;
    needId=(await prisma.needList.create({data:{organization_id:orgId,company_id:compAId,branch_id:branchId,name:'TEST-ATT Attachment fixture'}})).id;
    tokenA=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;
    tokenB=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password}).expect(200)).body.access_token;
    imageDirectory=path.resolve(process.cwd(),'../output/attachment-tests',suffix);fs.mkdirSync(imageDirectory,{recursive:true});
    // Create a dummy file
    fs.writeFileSync(path.join(imageDirectory,'test-image.jpg'), await sharp({create:{width:1,height:1,channels:3,background:'#ffffff'}}).jpeg().toBuffer());
    fs.writeFileSync(path.join(imageDirectory,'test-image.txt'), 'dummy text content');
  }, 30000);

  afterAll(async () => {
    // Teardown
    if (prisma) {
      await prisma.attachment.deleteMany({ where: { company_id: { in: [compAId, compBId].filter((id): id is string => !!id) } }});
      if(needId)await prisma.needList.deleteMany({ where: { id: needId } });
    }
    
    if (imageDirectory&&fs.existsSync(path.join(imageDirectory,'test-image.jpg'))) fs.unlinkSync(path.join(imageDirectory,'test-image.jpg'));
    if (imageDirectory&&fs.existsSync(path.join(imageDirectory,'test-image.txt'))) fs.unlinkSync(path.join(imageDirectory,'test-image.txt'));
    if (app) await app.close();
  });

  let attachmentId: string;

  it('should reject invalid mime type', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/attachments')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-company-id', compAId)
      .set('x-branch-id', branchId)
      .field('entityType', 'PURCHASE')
      .field('entityId', uuidv4())
      .field('category', 'PURCHASE_BILL')
      .attach('file', path.join(imageDirectory,'test-image.txt'), { contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Unsupported file type');
  });

  it('should successfully upload an image', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/attachments')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-company-id', compAId)
      .set('x-branch-id', branchId)
      .field('entityType', 'NEED')
      .field('entityId', needId)
      .field('category', 'NEED_PHOTO')
      .attach('file', path.join(imageDirectory,'test-image.jpg'), { contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.mimeType).toBe('image/jpeg');
    
    attachmentId = res.body.id;
  });

  it('should retrieve the attachment', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-company-id', compAId);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    const metadata=await sharp(res.body).metadata();
    expect(metadata.format).toBe('jpeg');expect(metadata.width).toBe(1);expect(metadata.height).toBe(1);
  });

  it('should prevent cross-tenant access', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-company-id', compBId); // using B's valid scope, trying to fetch A's attachment

    expect(res.status).toBe(404);
  });

  it('should delete the attachment and physical file', async () => {
    const dbFile = await prisma.attachment.findUnique({ where: { id: attachmentId }});
    const key = dbFile!.storage_key;
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage');
    const fullPath = path.join(uploadDir, key);
    
    expect(fs.existsSync(fullPath)).toBe(true);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-company-id', compAId);

    expect(res.status).toBe(200);

    // Verify DB
    const checkDb = await prisma.attachment.findUnique({ where: { id: attachmentId }});
    expect(checkDb).toBeNull();

    // Verify physical file is gone
    expect(fs.existsSync(fullPath)).toBe(false);
  });
});
