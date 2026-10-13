import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import {TenantProvisioningService} from '../src/platform/provisioning/tenant-provisioning.service';

describe('Real local PostgreSQL backup and disposable restore',()=>{
  let app:INestApplication;let db:PrismaService;let token:string;let backupId:string;let sourceOrganizations:number;let sourceMigrations:any[];
  const suffix=Date.now();const password='BackupTestOnly!921';
  const targetDatabase=process.env.BACKUP_RESTORE_DATABASE||'evolix_master_restore_test';
  let recoveryMarker:{id:string,name:string,code:string};
  const protectedShops:{organization:string;company:string;item:string;party:string}[]=[];
  const post=(url:string)=>request(app.getHttpServer()).post('/platform/admin/'+url).set('Authorization','Bearer '+token);
  beforeAll(async()=>{
    process.env.BACKUP_RESTORE_DATABASE=targetDatabase;
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN'},update:{}});
    await db.platformUser.create({data:{username:'backup-test-'+suffix,display_name:'Backup verifier',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id}}}});
    const res=await request(app.getHttpServer()).post('/platform/auth/login').send({username:'backup-test-'+suffix,password}).expect(200);token=res.body.access_token;
    for(const code of ['STARTER','SMART','PRO']){
      const plan=await db.plan.findUniqueOrThrow({where:{code}});
      const shop=await app.get(TenantProvisioningService).provisionTenant({planId:plan.id,organizationName:'Backup '+code+' '+suffix,adminName:'Backup owner',adminEmail:'backup-'+code+'-'+suffix+'@test.invalid',adminPassword:password});
      const login=await request(app.getHttpServer()).post('/auth/login').send({username:shop.user.username,password}).expect(200);
      const retail=(path:string)=>request(app.getHttpServer()).post('/api/v1/retail/'+path).set('Authorization','Bearer '+login.body.access_token).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
      const item=(await retail('items').send({name:'Protected '+code,selling_price:10,opening_stock:2,opening_cost:3}).expect(201)).body;
      const party=(await retail('customers').send({name:'Protected Customer '+code}).expect(201)).body;
      protectedShops.push({organization:shop.organization.id,company:shop.company.id,item:item.id,party:party.id});
    }
  });
  afterAll(async()=>{delete process.env.BACKUP_RESTORE_DATABASE;await app.close();});
  it('creates a real nonempty archive without exposing its storage key',async()=>{
    recoveryMarker=await db.organization.create({data:{name:'Restore drill original '+suffix,code:'RESTORE_DRILL_'+suffix}});
    sourceOrganizations=await db.organization.count();
    sourceMigrations=await db.$queryRaw<any[]>`SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL`;
    const result=await post('backups').send({}).expect(201);backupId=result.body.id;
    expect(result.body.storage_key).toBeUndefined();expect(result.body.size_bytes).toBeGreaterThan(0);expect(result.body.status).toBe('CREATED');
  },120000);
  it('verifies the PostgreSQL archive and rejects unconfirmed restore',async()=>{
    const verified=await post('backups/'+backupId+'/verify').send({}).expect(201);
    expect(verified.body.archive_entries).toBeGreaterThan(0);expect(verified.body.verified_at).toBeTruthy();
    await post('backups/'+backupId+'/restore').send({target_database:targetDatabase,reason:'Restore verification',confirmation:'WRONG'}).expect(400);
  });
  it('restores real data into the configured disposable target with a safety backup and audit',async()=>{
    const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+targetDatabase;
    const target=new PrismaClient({datasourceUrl:url.toString()});
    try{
      // The disposable target may contain a different restored tenant-number sequence.
      // Use a vacant negative fixture number; the real restore replaces it with source data.
      const minimum=await target.organization.aggregate({_min:{tenant_number:true}});
      const fixtureNumber=Math.min(0,minimum._min.tenant_number||0)-1;
      await target.organization.upsert({where:{id:recoveryMarker.id},create:{...recoveryMarker,tenant_number:fixtureNumber,name:'Changed after backup'},update:{name:'Changed after backup'}});
      expect((await target.organization.findUniqueOrThrow({where:{id:recoveryMarker.id}})).name).toBe('Changed after backup');
    }finally{await target.$disconnect();}
    const result=await post('backups/'+backupId+'/restore').send({target_database:targetDatabase,reason:'Verify a real PostgreSQL restoration',confirmation:'RESTORE '+targetDatabase}).expect(201);
    expect(result.body.status).toBe('RESTORED');expect(result.body.safety_backup_id).toBeTruthy();
    const restored=new PrismaClient({datasourceUrl:url.toString()});
    try{
      expect(await restored.organization.count()).toBe(sourceOrganizations);
      expect((await restored.organization.findUniqueOrThrow({where:{id:recoveryMarker.id}})).name).toBe(recoveryMarker.name);
      expect(await restored.platformUser.count({where:{username:'backup-test-'+suffix}})).toBe(1);
      expect(await restored.$queryRaw<any[]>`SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL`).toEqual(sourceMigrations);
      // Whole-database archives preserve customer, inventory and accounting records on every paid tier.
      for(const shop of protectedShops){
        expect(await restored.organization.count({where:{id:shop.organization}})).toBe(1);
        expect(await restored.party.count({where:{id:shop.party,company_id:shop.company}})).toBe(1);
        expect(await restored.item.count({where:{id:shop.item,company_id:shop.company}})).toBe(1);
        expect(await restored.stockMovement.count({where:{company_id:shop.company,item_id:shop.item}})).toBeGreaterThan(0);
        expect(await restored.voucher.count({where:{company_id:shop.company,status:'POSTED'}})).toBeGreaterThan(0);
      }
    }finally{await restored.$disconnect();}
    expect(await db.platformAuditLog.count({where:{action:'BACKUP_RESTORE_SUCCESS',resource_id:backupId}})).toBe(1);
    expect((await db.platformBackup.findUnique({where:{id:result.body.safety_backup_id}}))?.type).toBe('PRE_RESTORE');
  },120000);
});
