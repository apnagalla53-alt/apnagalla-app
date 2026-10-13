// Disposable test fixtures only; cannot seed a development or customer database.
require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),bcrypt=require('bcrypt');
const url=new URL(process.env.DATABASE_URL||'');
if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_test')||process.env.NODE_ENV==='production')throw new Error('Only an explicit local *_test database is permitted');
const {NestFactory}=require('@nestjs/core'),{AppModule}=require('../dist/app.module'),{PrismaService}=require('../dist/database/prisma.service'),{TenantProvisioningService}=require('../dist/platform/provisioning/tenant-provisioning.service');
(async()=>{
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
  try {
    const suffix=Date.now(),db=app.get(PrismaService);
    const password=crypto.randomBytes(24).toString('base64url')+'A1!';
    const platformPassword=crypto.randomBytes(24).toString('base64url')+'A1!';
    const username='browser-admin-'+suffix+'@test.invalid',platformUsername='browser-superadmin-'+suffix;
    const owner=await app.get(TenantProvisioningService).provisionTenant({organizationName:'Disposable Browser Shop '+suffix,adminName:'Browser Admin Owner',adminEmail:username,adminPassword:password});
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},update:{},create:{name:'SUPER_ADMIN'}});
    await db.platformUser.create({data:{username:platformUsername,display_name:'Disposable Platform Operator',password_hash:await bcrypt.hash(platformPassword,12),roles:{create:{role_id:role.id}}}});
    const filename=path.resolve('../scratchpad/phase8-browser-credentials.json');
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,JSON.stringify({retailUsername:username,retailPassword:password,platformUsername,platformPassword,companyId:owner.company.id,branchId:owner.branch.id,financialYearId:owner.financialYear.id}),{mode:0o600});
    console.log('Created disposable browser fixtures; credentials saved only in ignored scratchpad.');
  }finally{await app.close();}
})().catch(()=>{console.error('Disposable browser fixture provisioning failed');process.exitCode=1;});
