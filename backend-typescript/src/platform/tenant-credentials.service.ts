import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { AuthEmailService } from '../auth/auth-email.service';
import { authTokenHash } from '../auth/password-lifecycle.service';
import { validatePassword } from '../auth/password-policy';
@Injectable()
export class TenantCredentialsService {
 constructor(private db:PrismaService,private email:AuthEmailService){}
 async reset(orgId:string,userId:string,action:'RESET_LINK'|'FORCE_CHANGE'|'TEMPORARY'|'REVOKE',reason:string,actor:string,password?:string){
  const token=randomBytes(32).toString('base64url');let temporaryHash:string|undefined;
  if(action==='TEMPORARY'){if(!password)throw new BadRequestException('Provide a new temporary password. Existing passwords cannot be retrieved.');validatePassword(password);temporaryHash=await bcrypt.hash(password,12);}
  const result=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
   const user=await tx.user.findFirst({where:{id:userId,organization_id:orgId}});if(!user)throw new NotFoundException('Tenant user not found.');
   if(action==='RESET_LINK'&&(!this.email.isConfigured()||!user.email_verified_at||!user.email))throw new BadRequestException('A configured email provider and verified recovery email are required.');
   if(action==='FORCE_CHANGE'&&!user.password_login_enabled)throw new BadRequestException('This account uses a verified provider. Set an explicit temporary password or revoke its sessions.');
   let resetId:string|undefined;
   await tx.authToken.updateMany({where:{user_id:userId,used_at:null},data:{used_at:new Date()}});
   if(action==='RESET_LINK')resetId=(await tx.authToken.create({data:{user_id:userId,purpose:'PASSWORD_RESET',token_hash:authTokenHash(token),expires_at:new Date(Date.now()+1200000)}})).id;
   if(action==='TEMPORARY'){
    if(await bcrypt.compare(password!,user.password_hash))throw new BadRequestException('Choose a different temporary password.');
    await tx.passwordHistory.create({data:{user_id:userId,password_hash:user.password_hash}});
    await tx.user.update({where:{id:userId},data:{password_hash:temporaryHash,password_login_enabled:true,must_change_password:true,temporary_password_expires_at:new Date(Date.now()+86400000),failed_login_count:0,is_locked:false}});
   }
   if(action==='FORCE_CHANGE')await tx.user.update({where:{id:userId},data:{must_change_password:true}});
   await tx.session.updateMany({where:{user_id:userId,revoked_at:null},data:{revoked_at:new Date()}});
   await tx.platformAuditLog.create({data:{user_id:actor,action:'USER_CREDENTIAL_'+action,resource_type:'Organization',resource_id:orgId,details:JSON.stringify({target_user:userId,reason})}});
   return {email:user.email,resetId};
  });
  if(action==='RESET_LINK'){try{await this.email.sendPasswordReset(result.email!,token);}catch(e){await this.db.authToken.deleteMany({where:{id:result.resetId}});throw e;}}
  return {success:true,message:action==='TEMPORARY'?'Temporary password set. The user must change it within 24 hours.':'Access action completed. Existing passwords are never exposed.'};
 }
}
