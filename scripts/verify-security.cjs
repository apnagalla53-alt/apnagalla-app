// Local disposable-only verification. Run from repository root. Operator
// credentials must have CREATE DATABASE/ROLE for the restricted-role test.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),backend=path.join(root,'backend-typescript');
const {PrismaClient}=require(path.join(backend,'node_modules/@prisma/client'));
const dotenv=require(path.join(backend,'node_modules/dotenv'));
const maintenance=path.join(backend,'.env.maintenance.local');
const env={...process.env,...(fs.existsSync(maintenance)?dotenv.parse(fs.readFileSync(maintenance)):{})};
if(!env.DATABASE_URL)throw Error('Inject an operator DATABASE_URL or configure ignored .env.maintenance.local. Never use a customer database.');
const url=new URL(env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Local disposable databases only');
const name='evolix_security_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex')+'_test';
url.pathname='/postgres';const operator=new PrismaClient({datasources:{db:{url:url.toString()}}});url.pathname='/'+name;
const output=path.join(root,'scratchpad/security-verification',name);fs.mkdirSync(output,{recursive:true});
const uploads=path.join(output,'uploads');
Object.assign(env,{DATABASE_URL:url.toString(),NODE_ENV:'test',JWT_SECRET:crypto.randomBytes(48).toString('hex'),PLATFORM_JWT_SECRET:crypto.randomBytes(48).toString('hex'),MFA_ENCRYPTION_KEY:crypto.randomBytes(32).toString('base64'),BACKUP_PROVIDER:'none',STORAGE_PROVIDER:'local',UPLOAD_DIR:uploads,GOOGLE_CLIENT_ID:'',EMAIL_PROVIDER:'none',SMS_PROVIDER:'none',TENANT_BOOTSTRAP_PASSWORD:'',PLATFORM_BOOTSTRAP_PASSWORD:''});
function run(args){const r=spawnSync(process.execPath,args,{cwd:backend,env,encoding:'utf8',windowsHide:true,maxBuffer:40*1024*1024});fs.appendFileSync(path.join(output,'tests.log'),(r.stdout||'')+(r.stderr||''));return r.status??1;}
(async()=>{let created=false,status=1;try{
 await operator.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
 status=run(['node_modules/prisma/build/index.js','migrate','deploy']);
 if(!status)status=run(['node_modules/prisma/build/index.js','migrate','status']);
 if(!status)status=run(['node_modules/prisma/build/index.js','validate']);
 if(!status)status=run(['node_modules/vitest/vitest.mjs','run','--config','vitest.config.e2e.ts','test/security-audit-20261012.e2e-spec.ts','test/security-remediation.e2e-spec.ts','test/production-readiness.e2e-spec.ts','test/control-plane-security.e2e-spec.ts','test/tenant-administration.e2e-spec.ts','test/security.e2e-spec.ts','test/attachments.e2e-spec.ts','test/platform-control-plane.e2e-spec.ts']);
 if(!status)status=run(['node_modules/vitest/vitest.mjs','run','src/platform/auth/totp.spec.ts']);
 console.log('Security verification exit code: '+status+'; private evidence: '+path.relative(root,output));
 }finally{
  if(created)await operator.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');await operator.$disconnect();
  const allowed=path.resolve(root,'scratchpad/security-verification');const resolved=path.resolve(uploads);
  if(!resolved.startsWith(allowed+path.sep)||fs.existsSync(resolved)&&fs.lstatSync(resolved).isSymbolicLink())throw Error('Unsafe disposable upload path');
  fs.rmSync(resolved,{recursive:true,force:true});
 }process.exitCode=status;
})().catch(e=>{console.error('Security verification failed: '+(e.code||e.constructor.name));process.exitCode=1;});
