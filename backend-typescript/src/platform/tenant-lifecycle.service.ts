import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AccountPolicyService } from '../auth/account-policy.service';
import { LocalStorageService } from '../attachments/storage/local-storage.service';
const models = Prisma.dmmf.datamodel.models;
const delegate = (name:string)=>name[0].toLowerCase()+name.slice(1);
// Platform audit, referral financial history and deletion receipts outlive the tenant.
const retained = new Set(['PlatformAuditLog','ReferralCode','ReferralAttribution','ReferralReward','TenantDeletionJob','MobileOtpChallenge']);
@Injectable()
export class TenantLifecycleService {
 constructor(private db:PrismaService,private policy:AccountPolicyService,private localStorage:LocalStorageService){}
 private async scope(tx:any,id:string){
   const org=await tx.organization.findUnique({where:{id}});if(!org)throw new NotFoundException('Tenant not found.');
   const companies=await tx.company.findMany({where:{organization_id:id},select:{id:true}});
   const scopes=new Map<string,any>(); const ids=new Map<string,any[]>();
   for(const model of models){if(retained.has(model.name))continue;const fields=new Set(model.fields.map(f=>f.name));
    const where=model.name==='Organization'?{id}:fields.has('organization_id')?{organization_id:id}:fields.has('company_id')?{company_id:{in:companies.map((c:any)=>c.id)}}:null;
    if(where)scopes.set(model.name,where);
   }
   // Only children without their own tenant/company scope inherit ownership from a parent.
   for(let pass=0;pass<models.length;pass++){
    let changed=false;
    for(const model of models){if(retained.has(model.name)||scopes.has(model.name))continue;
     const conditions:any[]=[];
     for(const relation of model.fields.filter(f=>f.kind==='object'&&f.relationFromFields?.length===1&&f.relationToFields?.[0]==='id')){
      const parent=models.find(m=>m.name===relation.type);if(!parent?.fields.some(f=>f.name==='id')||!scopes.has(parent.name))continue;
      if(!ids.has(parent.name))ids.set(parent.name,(await tx[delegate(parent.name)].findMany({where:scopes.get(parent.name),select:{id:true}})).map((r:any)=>r.id));
      conditions.push({[relation.relationFromFields![0]]:{in:ids.get(parent.name)}});
     }
     if(conditions.length){scopes.set(model.name,{OR:conditions});changed=true;}
    }if(!changed)break;
   }
   const counts:Record<string,number>={};for(const [name,where]of scopes){const count=await tx[delegate(name)].count({where});if(count)counts[name]=count;
    if(models.find(m=>m.name===name)!.fields.some(f=>f.name==='id')){const rows=await tx[delegate(name)].findMany({where,select:{id:true}});scopes.set(name,{id:{in:rows.map((r:any)=>r.id)}});}
   }
   return {org,scopes,counts};
 }
 async preview(id:string){
  return this.db.$transaction(async tx=>{const {org,counts}=await this.scope(tx,id);const policy=await this.policy.get(tx);
   const lastBackup=await tx.platformBackup.findFirst({where:{status:'VERIFIED',verified_at:{not:null}},orderBy:{created_at:'desc'},select:{id:true,verified_at:true,created_at:true}});
   const blockers:string[]=[];
   if(!org.archived_at)blockers.push('Archive the tenant first.');if(org.legal_hold)blockers.push('Tenant is under legal hold.');
   if(!policy.permanent_delete_enabled)blockers.push('Permanent deletion is disabled by platform policy.');
   if(policy.retention_days===null||!org.archived_at||org.archived_at.getTime()+policy.retention_days*86400000>Date.now())blockers.push('Configured retention period has not elapsed.');
   if(policy.delete_requires_backup&&(!lastBackup?.verified_at||Date.now()-lastBackup.verified_at.getTime()>86400000))blockers.push('A verified database backup from the past 24 hours is required.');
   const unsupported=await tx.attachment.count({where:{organization_id:id,storage_provider:{not:'local'}}});
   if(unsupported)blockers.push('Object-store version erasure is not verified. This tenant requires a provider storage-erasure workflow before permanent deletion.');
   return {tenant:{id:org.id,name:org.name,code:org.code,archived_at:org.archived_at,legal_hold:org.legal_hold},counts,total_rows:Object.values(counts).reduce((a,b)=>a+b,0),policy,backup:lastBackup,blockers,confirmation:'DELETE '+org.code,retained_records:['Platform audit trail','Deletion receipt','Detached referral financial history','Shared database recovery archive'],storage_erasure_supported:unsupported===0};
  },{timeout:30000});
 }
 async archive(id:string,reason:string,actor:string,restore=false){
  return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM organizations WHERE id=${id}::uuid FOR UPDATE`;const org=await tx.organization.findUnique({where:{id}});if(!org)throw new NotFoundException('Tenant not found.');
   if(restore&&!org.archived_at)throw new BadRequestException('Tenant is not archived.');if(!restore&&org.archived_at)throw new ConflictException('Tenant is already archived.');
   const previous=org.status;const status=restore?(org.archive_previous_status||'SUSPENDED'):'ARCHIVED';
   await tx.organization.update({where:{id},data:{status:status as any,is_active:restore&&!['SUSPENDED','CANCELLED','ARCHIVED'].includes(status),archived_at:restore?null:new Date(),archive_previous_status:restore?null:previous}});
   await tx.session.updateMany({where:{user:{organization_id:id},revoked_at:null},data:{revoked_at:new Date()}});
   await tx.platformSupportSession.updateMany({where:{organization_id:id,ended_at:null},data:{ended_at:new Date()}});
   await tx.platformAuditLog.create({data:{user_id:actor,action:restore?'TENANT_RESTORE':'TENANT_ARCHIVE',resource_type:'Organization',resource_id:id,details:JSON.stringify({reason,previous,status})}});
   return {success:true,status,data_preserved:true};
  });
 }
 async purge(id:string,confirmation:string,reason:string,actor:string){
  // Every database deletion is atomic; no TRUNCATE, CASCADE or disabled constraints.
  const result=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM organizations WHERE id=${id}::uuid FOR UPDATE`;
   const {org,scopes,counts}=await this.scope(tx,id);const policy=await this.policy.get(tx);
   if(confirmation!=='DELETE '+org.code)throw new BadRequestException('Typed confirmation does not match.');
   if(!org.archived_at||org.legal_hold||!policy.permanent_delete_enabled||policy.retention_days===null||org.archived_at.getTime()+policy.retention_days*86400000>Date.now())throw new BadRequestException('Archive, legal hold or retention policy blocks deletion.');
   const attachments=await tx.attachment.findMany({where:{organization_id:id},select:{company_id:true,storage_key:true,storage_provider:true}});
   if(attachments.some(a=>a.storage_provider!=='local'||!a.storage_key.startsWith(a.company_id+'/')))throw new BadRequestException('A verified object-store version erasure workflow is required for these attachments.');
   // Refuse corrupt cross-tenant references instead of allowing FK cascades to touch another shop.
   for(const model of models){if(retained.has(model.name)||!scopes.has(model.name))continue;
    for(const relation of model.fields.filter(f=>f.kind==='object'&&f.relationFromFields?.length===1&&f.relationToFields?.[0]==='id')){
     const parentScope=scopes.get(relation.type);if(!parentScope?.id?.in?.length)continue;
     const outside=await (tx as any)[delegate(model.name)].count({where:{AND:[{NOT:scopes.get(model.name)},{[relation.relationFromFields![0]]:{in:parentScope.id.in}}]}});
     if(outside)throw new ConflictException('Cross-tenant references require an integrity review. No tenant records were deleted.');
    }
   }
   if(policy.delete_requires_backup&&!await tx.platformBackup.findFirst({where:{status:'VERIFIED',verified_at:{gt:new Date(Date.now()-86400000)}}}))throw new BadRequestException('A recent verified backup is required.');
   const job=await tx.tenantDeletionJob.create({data:{organization_id:id,actor_id:actor,reason,status:'RUNNING',snapshot:{name:org.name,code:org.code,archived_at:org.archived_at.toISOString(),storage_manifest:attachments.map(a=>({company_id:a.company_id,key:a.storage_key})),storage_cursor:0},counts}});
   const userIds=(await tx.user.findMany({where:{organization_id:id},select:{id:true}})).map(u=>u.id);
   await tx.mobileOtpChallenge.deleteMany({where:{user_id:{in:userIds}}});
   await tx.referralCode.updateMany({where:{organization_id:id},data:{organization_id:null,user_id:null,enabled:false}});
   await tx.referralAttribution.updateMany({where:{OR:[{referred_organization_id:id},{referred_user_id:{in:userIds}}]},data:{referred_organization_id:null,referred_user_id:null}});
   await tx.referralReward.updateMany({where:{beneficiary_organization_id:id},data:{beneficiary_organization_id:null}});
   // Break nullable references within this tenant before topologically deleting children.
   const pending=new Set([...scopes.keys()].filter(n=>counts[n]));
   const detached=new Map<string,Set<string>>();
   for(const name of pending){const model=models.find(m=>m.name===name)!;const nulls:any={};if(!model.fields.some(f=>f.name==='id'))continue;
    // Projection dimension keys have partial unique indexes: clearing them can
    // merge several variant/batch balances into the same standard-stock key.
    // Delete the scoped projections before their referenced dimensions instead.
    if(name==='StockBalanceProjection')continue;
    for(const relation of model.fields.filter(f=>f.kind==='object'&&f.relationFromFields?.length)){
     if(!pending.has(relation.type))continue;
     for(const field of relation.relationFromFields!){const scalar=model.fields.find(f=>f.name===field);if(scalar&&!scalar.isRequired&&!['company_id','organization_id'].includes(field))nulls[field]=null;}
    }
    if(Object.keys(nulls).length){await (tx as any)[delegate(name)].updateMany({where:scopes.get(name),data:nulls});detached.set(name,new Set(Object.keys(nulls)));}
   }
   while(pending.size){let progress=false;for(const name of [...pending]){
    const hasChild=[...pending].some(child=>child!==name&&models.find(m=>m.name===child)!.fields.some(f=>f.kind==='object'&&f.type===name&&f.relationFromFields?.some(field=>!detached.get(child)?.has(field))));
    if(hasChild)continue;
    await (tx as any)[delegate(name)].deleteMany({where:scopes.get(name)});pending.delete(name);progress=true;
   }if(!progress)throw new BadRequestException('A required dependency cycle needs a reviewed migration. No records have been deleted.');}
   await tx.tenantDeletionJob.update({where:{organization_id:id},data:{status:attachments.length?'STORAGE_PENDING':'COMPLETED',finished_at:attachments.length?null:new Date()}});
   await tx.platformAuditLog.create({data:{user_id:actor,action:'TENANT_PERMANENT_DELETE',resource_type:'Organization',resource_id:id,details:JSON.stringify({reason,code:org.code,counts,storage_objects:attachments.length,storage_status:attachments.length?'PENDING':'NOT_REQUIRED'})}});
   return {success:true,status:attachments.length?'STORAGE_PENDING':'COMPLETED',deleted_counts:counts,job_id:job.id};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000,maxWait:10000});
  if(result.status==='STORAGE_PENDING')return {...result,...await this.finishStorage(result.job_id,actor)};
  return result;
 }
 async deletionJobs(){return this.db.tenantDeletionJob.findMany({orderBy:{created_at:'desc'},take:100,select:{id:true,organization_id:true,status:true,reason:true,created_at:true,finished_at:true,error_code:true,counts:true}});}
 async finishStorage(jobId:string,actor:string){
   const job=await this.db.tenantDeletionJob.findUnique({where:{id:jobId}});if(!job)throw new NotFoundException('Deletion job not found.');
   if(job.status==='COMPLETED')return {status:'COMPLETED',job_id:jobId};
   const snapshot=structuredClone(job.snapshot) as any;
   const lease=snapshot.storage_lease_at?new Date(snapshot.storage_lease_at).getTime():job.created_at.getTime();
   if(!['STORAGE_PENDING','STORAGE_RETRY'].includes(job.status)&&!(job.status==='STORAGE_RUNNING'&&lease<Date.now()-300000))throw new ConflictException('Storage erasure is already running.');
   snapshot.storage_lease_at=new Date().toISOString();
   const claimed=await this.db.tenantDeletionJob.updateMany({where:{id:jobId,status:job.status,snapshot:{equals:job.snapshot as Prisma.InputJsonValue}},data:{status:'STORAGE_RUNNING',snapshot}});if(!claimed.count)throw new ConflictException('Storage erasure is already running.');
   try{const manifest=snapshot.storage_manifest||[];
     for(let index=Number(snapshot.storage_cursor||0);index<manifest.length;index++){
       const entry=manifest[index];if(typeof entry.key!=='string'||!entry.key.startsWith(entry.company_id+'/'))throw new Error('Invalid scoped manifest');
       await this.localStorage.delete(entry.key);
       try{await this.localStorage.get(entry.key);throw new Error('Object remains after deletion');}catch(e:any){if(e?.getStatus?.()!==404)throw e;}
       snapshot.storage_cursor=index+1;await this.db.tenantDeletionJob.update({where:{id:jobId},data:{snapshot}});
     }
     await this.db.$transaction(async tx=>{await tx.tenantDeletionJob.update({where:{id:jobId},data:{status:'COMPLETED',finished_at:new Date(),error_code:null,snapshot:{...snapshot,storage_manifest:[]}}});await tx.platformAuditLog.create({data:{user_id:actor,action:'TENANT_STORAGE_ERASURE_COMPLETE',resource_type:'Organization',resource_id:job.organization_id,details:JSON.stringify({job_id:jobId,objects:manifest.length})}});});
     return {status:'COMPLETED',job_id:jobId};
   }catch{await this.db.tenantDeletionJob.update({where:{id:jobId},data:{status:'STORAGE_RETRY',error_code:'STORAGE_ERASURE_FAILED'}});return {status:'STORAGE_RETRY',job_id:jobId,message:'Database removal completed; private storage erasure needs retry. No complete erasure claim is made.'};}
 }
}
