const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../backend-typescript');const env={...process.env,...require(path.join(root,'node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'.env')))};
const url=new URL(env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Only disposable localhost PostgreSQL databases are allowed.');
const {PrismaClient}=require(path.join(root,'node_modules/@prisma/client'));
const existing=process.argv[2]==='--existing';const name=existing?process.argv[3]:'evolix_control_chain_'+Date.now()+'_test';
if(!/^evolix_[a-z0-9_]+_test$/.test(name))throw Error('Use an explicitly named evolix_*_test disposable database.');
(async()=>{const db=new PrismaClient({datasources:{db:{url:url.toString()}}});if(!existing){await db.$executeRawUnsafe('CREATE DATABASE "'+name+'"');}await db.$disconnect();url.pathname='/'+name;
 const steps=[['migrate','deploy'],['migrate','status'],['validate']];const output=path.resolve(__dirname,'../output/platform-control');fs.mkdirSync(output,{recursive:true});
 for(const step of steps){const r=spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),...step],{cwd:root,env:{...env,DATABASE_URL:url.toString()},encoding:'utf8',windowsHide:true});fs.writeFileSync(path.join(output,'migration-'+name+'-'+step.join('-')+'.log'),r.stdout+r.stderr);console.log(name+': '+step.join(' ')+' exit '+r.status);if(r.status!==0)process.exit(1);}
})().catch(e=>{console.error(e.message.replaceAll(url.toString(),'[database]'));process.exit(1);});
