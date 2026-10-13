// Operator recovery only. Separate credentials are deliberately never read by
// the API runtime. Usage: node scripts/platform-mfa-reset.cjs username reason
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const [username,reason]=process.argv.slice(2);
if(!username||!reason||reason.length<10)throw Error('Provide an exact administrator username and an audit reason of at least 10 characters. Verify their identity before proceeding.');
const privateFile=path.resolve(__dirname,'../.env.maintenance.local');
const local=fs.existsSync(privateFile)?require('dotenv').parse(fs.readFileSync(privateFile)):{};
const connection=process.env.EVOLIX_MAINTENANCE_DATABASE_URL||local.DATABASE_URL;
if(!connection)throw Error('Configure the operator job connection; never use API runtime credentials for recovery.');
const db=new PrismaClient({datasources:{db:{url:connection}}});
(async()=>{
 try{
  const [role]=await db.$queryRaw`SELECT current_user = pg_get_userbyid(relowner) AS owns_table FROM pg_class WHERE relname='platform_users' AND relnamespace='public'::regnamespace`;
  if(!role?.owns_table)throw Error('Authenticator recovery requires the operator/migration owner connection.');
  const user=await db.platformUser.findUniqueOrThrow({where:{username}});
  await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM platform_users WHERE id=${user.id}::uuid FOR UPDATE`;
   await tx.platformUser.update({where:{id:user.id},data:{mfa_secret_encrypted:null,mfa_enabled_at:null,mfa_last_counter:null,mfa_recovery_hashes:[]}});
   await tx.platformMfaChallenge.updateMany({where:{user_id:user.id,used_at:null},data:{used_at:new Date()}});
   await tx.platformSession.updateMany({where:{user_id:user.id,revoked_at:null},data:{revoked_at:new Date()}});
   await tx.platformAuditLog.create({data:{user_id:user.id,action:'MFA_OPERATOR_RESET',resource_type:'PlatformUser',resource_id:user.id,details:JSON.stringify({reason:reason.slice(0,2000),operator_source:'maintenance CLI'})}});
  });
  console.log('Authenticator reset audited; sessions revoked. The administrator must enroll at their next sign-in.');
 }finally{await db.$disconnect();}
})().catch(e=>{console.error('Recovery failed: '+(e.code||e.constructor.name));process.exitCode=1;});
