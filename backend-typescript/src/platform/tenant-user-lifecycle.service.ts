import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
const erasable=new Set(['Session','PasswordHistory','AuthToken','UserRole']);
@Injectable()
export class TenantUserLifecycleService {
 constructor(private db:PrismaService){}
 private async dependencies(tx:any,orgId:string,userId:string){const user=await tx.user.findFirst({where:{id:userId,organization_id:orgId},select:{id:true,username:true,is_active:true}});if(!user)throw new NotFoundException('Tenant user not found.');const counts:Record<string,number>={};
  for(const model of Prisma.dmmf.datamodel.models){if(['User','ReferralCode','ReferralAttribution','MobileOtpChallenge'].includes(model.name))continue;
   const refs=model.fields.filter(f=>f.kind==='object'&&f.type==='User'&&f.relationFromFields?.length===1).map(f=>f.relationFromFields![0]);if(!refs.length)continue;
   const count=await tx[model.name[0].toLowerCase()+model.name.slice(1)].count({where:{OR:refs.map(f=>({[f]:userId}))}});if(count)counts[model.name]=count;
  }
  const blockers=Object.entries(counts).filter(([m])=>!erasable.has(m)).map(([m,c])=>`${m}: ${c} historical references. Disable the user and retain these business records.`);
  if(user.is_active)blockers.push('Disable this account and revoke access before deletion.');
  return {user,counts,blockers,confirmation:'DELETE '+user.username};
 }
 async preview(orgId:string,userId:string){return this.db.$transaction(tx=>this.dependencies(tx,orgId,userId),{timeout:30000});}
 async remove(orgId:string,userId:string,confirmation:string,reason:string,actor:string){return this.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;const scope=await this.dependencies(tx,orgId,userId);
  if(confirmation!==scope.confirmation||scope.blockers.length)throw new BadRequestException('Confirmation or historical record retention blocks account deletion.');
  await tx.mobileOtpChallenge.deleteMany({where:{user_id:userId}});await tx.referralCode.updateMany({where:{user_id:userId},data:{user_id:null}});await tx.referralAttribution.updateMany({where:{referred_user_id:userId},data:{referred_user_id:null}});
  await tx.session.deleteMany({where:{user_id:userId}});await tx.authToken.deleteMany({where:{user_id:userId}});await tx.passwordHistory.deleteMany({where:{user_id:userId}});await tx.userRole.deleteMany({where:{user_id:userId}});await tx.user.delete({where:{id:userId}});
  await tx.platformAuditLog.create({data:{user_id:actor,action:'TENANT_USER_DELETE',resource_type:'Organization',resource_id:orgId,details:JSON.stringify({target_user:userId,reason,counts:scope.counts})}});return {success:true,tenant_preserved:true};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});}
}
