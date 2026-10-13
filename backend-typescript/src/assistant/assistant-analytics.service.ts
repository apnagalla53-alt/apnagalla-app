import { Injectable,BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AssistantCatalogService } from './assistant-catalog.service';
import { dateRange } from './nlp';
@Injectable()
export class AssistantAnalyticsService {
  constructor(private db:PrismaService,private catalog:AssistantCatalogService){}
  async unknown(query:{search?:string;offset?:string}={}){return this.db.assistantQueryLog.groupBy({by:['normalized_message'],where:{status:'UNKNOWN',created_at:{gte:new Date(Date.now()-30*86400000)},...(query.search?{normalized_message:{contains:query.search,mode:'insensitive' as const}}:{})},_count:{_all:true},_max:{created_at:true},orderBy:[{_count:{normalized_message:'desc'}},{_max:{created_at:'desc'}}],take:50,skip:Math.min(100000,Math.max(0,Number(query.offset)||0))});}
  async map(userId:string,dto:{phrase:string;intent_code:string;language:string}){
    if(!await this.db.assistantQueryLog.findFirst({where:{status:'UNKNOWN',normalized_message:dto.phrase}}))throw new BadRequestException('Select a logged unrecognized phrase');
    return this.catalog.add(userId,dto,'UNKNOWN_MAPPED');
  }
  async summary(){
    const since=new Date(Date.now()-30*86400000),where={created_at:{gte:since}};
    const tracked=['WHY_SALES_DOWN','WHY_PROFIT_DOWN','SALES_VS_PROFIT_EXPLANATION','BUSINESS_PROBLEM_SIGNALS'];
    const periods=['today','this week','this month'].map(q=>dateRange(q,'Asia/Kolkata'));
    // Timestamps, unlike business-date columns, need actual local-day boundaries.
    const counts=await Promise.all(periods.map(p=>this.db.assistantQueryLog.count({where:{created_at:{gte:new Date(p.from+'T00:00:00+05:30')}}})));
    const [statuses,top,latency,usage,tenants,unknown,diagnoses,diagnosisUsage]=await Promise.all([
      this.db.assistantQueryLog.groupBy({by:['status'],where,_count:{_all:true}}),
      this.db.assistantQueryLog.groupBy({by:['intent_code'],where:{...where,intent_code:{not:null}},_count:{_all:true},orderBy:{_count:{intent_code:'desc'}},take:10}),
      this.db.$queryRaw<{average:number;p50:number;p95:number;p99:number}[]>`SELECT COALESCE(avg(total_ms),0)::float8 AS average, COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms),0)::float8 AS p50, COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms),0)::float8 AS p95, COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY total_ms),0)::float8 AS p99 FROM assistant_query_logs WHERE created_at >= ${since}`,
      this.db.$queryRaw<{day:string;questions:number}[]>`SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS day, count(*)::int AS questions FROM assistant_query_logs WHERE created_at >= ${since} GROUP BY day ORDER BY day DESC LIMIT 30`,
      this.db.assistantQueryLog.groupBy({by:['company_id'],where,_count:{_all:true},_avg:{total_ms:true},orderBy:{_count:{company_id:'desc'}},take:50}),this.unknown(),
      this.db.$queryRaw<{total:number;insufficient:number;cost_limited:number;p50:number;p95:number;p99:number}[]>`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE COALESCE((timings->>'diagnosis_insufficient')::int,0)=1)::int AS insufficient, COUNT(*) FILTER (WHERE COALESCE((timings->>'diagnosis_cost_limited')::int,0)=1)::int AS cost_limited, COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms),0)::float8 AS p50, COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms),0)::float8 AS p95, COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY total_ms),0)::float8 AS p99 FROM assistant_query_logs WHERE created_at >= ${since} AND timings ? 'diagnosis_driver_count'`,
      this.db.assistantQueryLog.groupBy({by:['intent_code','status'],where:{...where,intent_code:{in:tracked}},_count:{_all:true}}),
    ]);
    const total=statuses.reduce((s,g)=>s+g._count._all,0),count=(status:string)=>statuses.find(s=>s.status===status)?._count._all||0;
    const rawDiagnoses=diagnoses[0]||{total:0,insufficient:0,cost_limited:0,p50:0,p95:0,p99:0},diagnosisAttempts=diagnosisUsage.reduce((sum,g)=>sum+g._count._all,0),diagnosisErrors=diagnosisUsage.filter(g=>g.status==='ERROR').reduce((sum,g)=>sum+g._count._all,0);
    const trackedIntents=tracked.map(code=>({intent_code:code,questions:diagnosisUsage.filter(g=>g.intent_code===code).reduce((sum,g)=>sum+g._count._all,0),errors:diagnosisUsage.filter(g=>g.intent_code===code&&g.status==='ERROR').reduce((sum,g)=>sum+g._count._all,0)}));
    return {window:'last 30 days',questions_today:counts[0],questions_week:counts[1],questions_month:counts[2],total,recognized_rate:total?(total-count('UNKNOWN'))/total*100:0,unknown_rate:total?count('UNKNOWN')/total*100:0,ambiguous_rate:total?count('AMBIGUOUS')/total*100:0,errors:count('ERROR'),permission_denials:count('PERMISSION_DENIED'),statuses,latency:latency[0],diagnoses:{...rawDiagnoses,error_rate:diagnosisAttempts?diagnosisErrors/diagnosisAttempts*100:0,tracked_intents:trackedIntents},top_intents:top,usage,tenants:tenants.map(t=>({company_id:t.company_id,questions:t._count._all,average_latency:t._avg.total_ms})),unknown,external_calls:0,definition:'Recognition is a recognized intent or clarification, not proof of business-answer correctness. Only operational questions/status/timing and aggregate diagnosis quality are retained; no financial response payload.'};
  }
}
