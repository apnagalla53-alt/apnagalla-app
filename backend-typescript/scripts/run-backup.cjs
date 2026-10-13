// Invoke from an operator scheduler. This does not install a cron job or contact customers.
const {NestFactory}=require('@nestjs/core');
const {AppModule}=require('../dist/app.module');
const {PrismaService}=require('../dist/database/prisma.service');
const {PlatformBackupService}=require('../dist/platform/backup.service');
(async()=>{
  let app;
  try {
    app=await NestFactory.createApplicationContext(AppModule,{logger:false});
    const db=app.get(PrismaService);
    const actor=await db.platformUser.findFirst({where:{is_active:true,is_locked:false,roles:{some:{role:{name:'SUPER_ADMIN'}}}},select:{id:true}});
    if(!actor)throw new Error('No authorized backup operator');
    const service=app.get(PlatformBackupService);
    const backup=await service.create(actor.id,'SCHEDULED');
    await service.verify(backup.id,actor.id);
    console.log(JSON.stringify({event:'backup_verified',backup_id:backup.id,version:process.env.APP_VERSION}));
  }catch {
    console.error(JSON.stringify({event:'backup_failed',version:process.env.APP_VERSION}));
    // Optional private HTTPS monitoring endpoint; contains no credentials, SQL or customer records.
    const endpoint=process.env.BACKUP_ALERT_WEBHOOK_URL;
    if(endpoint&&new URL(endpoint).protocol==='https:')try{await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'evolix_backup_failed',version:process.env.APP_VERSION}),signal:AbortSignal.timeout(10_000)});}catch{}
    process.exitCode=1;
  }finally{if(app)await app.close();}
})();
