import { LAUNCH_PLAN_REVISION, RETAIL_FEATURES, RETAIL_PLAN_DEFAULTS, defaultPlanFeatures } from '../common/retail-plan-catalog';

/** One-time commercial configuration revision. Never touches tenant business data or overrides. */
export async function installLaunchPlanRevision(tx:any) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LAUNCH_PLAN_REVISION}))`;
  if(await tx.platformSetting.findUnique({where:{key:LAUNCH_PLAN_REVISION}}))return false;
  for(const [code,row] of Object.entries(RETAIL_FEATURES)) {
    await tx.feature.upsert({where:{code},create:{code,name:row[0],description:row[2]},update:{name:row[0],description:row[2]}});
  }
  const changes=[];
  for(const definition of RETAIL_PLAN_DEFAULTS) {
    const previous=await tx.plan.findUnique({where:{code:definition.code},include:{plan_features:{include:{feature:true}}}});
    const plan=await tx.plan.upsert({where:{code:definition.code},create:definition,update:{name:definition.name,monthly_price:definition.monthly_price,description:definition.description,limits:definition.limits}});
    const features=await tx.feature.findMany({where:{code:{in:defaultPlanFeatures(definition.code)}}});
    await tx.planFeature.deleteMany({where:{plan_id:plan.id}});
    await tx.planFeature.createMany({data:features.map((feature:any)=>({plan_id:plan.id,feature_id:feature.id}))});
    changes.push({code:definition.code,previous:previous?{name:previous.name,price:String(previous.monthly_price),limits:previous.limits,features:previous.plan_features.map((p:any)=>p.feature.code)}:null,features:features.map((f:any)=>f.code),limits:definition.limits});
  }
  await tx.platformSetting.create({data:{key:LAUNCH_PLAN_REVISION,value:{applied_at:new Date().toISOString(),plans:changes,policy:'Only canonical plan configuration changed. Tenant overrides, stored images, stock, locations, staff, transaction snapshots and accounting retained.'}}});
  return true;
}
