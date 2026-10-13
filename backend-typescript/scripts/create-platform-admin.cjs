// Operator-only first administrator creation. No password arguments or defaults.
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcrypt');
const readline=require('node:readline/promises');
const db=new PrismaClient({log:[]});
async function hiddenPassword(prompt){
  if(!process.stdin.isTTY)throw new Error('Run interactively in a private operator terminal');
  process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{let value='';const onData=buffer=>{
    for(const char of buffer.toString()){
      if(char==='\u0003'){finish();reject(new Error('Cancelled'));return;}
      if(char==='\r'||char==='\n'){finish();resolve(value);return;}
      if(char==='\u007f'||char==='\b'){value=value.slice(0,-1);continue;}
      if(char.charCodeAt(0)>=32)value+=char;
    }
  };function finish(){process.stdin.removeListener('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',onData);});
}
(async()=>{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
  if(await db.platformUser.count({where:{roles:{some:{role:{name:'SUPER_ADMIN'}}}}}))throw new Error('A Super Admin already exists. Use the audited account recovery process');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  const username=(await rl.question('New Super Admin username/email: ')).trim();
  const confirmation=await rl.question('Type CREATE FIRST SUPER ADMIN: ');rl.close();
  if(!/^[a-zA-Z0-9@._+-]{3,255}$/.test(username)||confirmation!=='CREATE FIRST SUPER ADMIN')throw new Error('Invalid username or confirmation');
  const password=await hiddenPassword('Password (hidden, at least 16 characters): ');
  const repeated=await hiddenPassword('Repeat password: ');
  if(password!==repeated||password.length<16||Buffer.byteLength(password,'utf8')>72||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||! /[^a-zA-Z0-9]/.test(password))throw new Error('Password must match and contain uppercase, lowercase, number and symbol');
  const passwordHash=await bcrypt.hash(password,12);
  await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(746221)::text`;
    if(await tx.platformUser.count({where:{roles:{some:{role:{name:'SUPER_ADMIN'}}}}}))throw new Error('Another operator already created the first administrator');
    const role=await tx.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN',system_role:true},update:{}});
    const user=await tx.platformUser.create({data:{username,display_name:'Platform Administrator',password_hash:passwordHash,roles:{create:{role_id:role.id}}}});
    await tx.platformAuditLog.create({data:{user_id:user.id,action:'FIRST_SUPER_ADMIN_CREATED',resource_type:'PlatformUser',resource_id:user.id,details:'Interactive operator CLI'}});
  });
  console.log('First Super Admin created. No credentials were written to files or logs.');
})().catch(()=>{console.error('Administrator creation failed. Check initialization, username uniqueness and password policy.');process.exitCode=1;}).finally(()=>db.$disconnect());
