import { Injectable,OnModuleInit,BadRequestException,OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DEFAULT_ALIASES,IntentRouter } from './intent-router';
import { INTENTS,INTENT_MAP } from './intent-library';
import { normalize,safeQuestion } from './nlp';
@Injectable()
export class AssistantCatalogService implements OnModuleInit,OnModuleDestroy {
  private router?:IntentRouter;
  private loaded=0;
  private timer?:NodeJS.Timeout;
  constructor(private db:PrismaService){}
  async onModuleInit(){
    await this.db.$transaction(INTENTS.map(i=>this.db.assistantIntentConfig.upsert({where:{code:i.code},create:{code:i.code},update:{}})));
    const unique=new Map(DEFAULT_ALIASES.map(a=>[a.normalized,a]));
    await this.db.$transaction([...unique.values()].map(a=>this.db.assistantExample.upsert({where:{normalized:a.normalized},create:{...a,language:/[\u0900-\u097f]/.test(a.phrase)?'hi':/aaj|kitna|batao|dikhao|ka |ki |se /.test(a.phrase)?'hinglish':'en'},update:{}})));
    // Refresh shipped mappings, preserving manually approved aliases and active flags.
    const defaults=await this.db.assistantExample.findMany({where:{source:'DEFAULT'},select:{id:true,normalized:true,intent_code:true}});
    const changes=defaults.filter(r=>unique.has(r.normalized)&&unique.get(r.normalized)!.intent_code!==r.intent_code);
    if(changes.length)await this.db.$transaction(changes.map(r=>this.db.assistantExample.update({where:{id:r.id},data:{intent_code:unique.get(r.normalized)!.intent_code}})));
    await this.reload();
    if(this.timer)clearInterval(this.timer);this.timer=setInterval(()=>void this.purge().catch(()=>{}),3600000);this.timer.unref();
  }
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  async purge(){await this.db.assistantConversation.deleteMany({where:{expires_at:{lt:new Date()}}});await this.db.assistantQueryLog.deleteMany({where:{created_at:{lt:new Date(Date.now()-30*86400000)}}});}
  async reload(){
    const [configs,examples]=await Promise.all([this.db.assistantIntentConfig.findMany(),this.db.assistantExample.findMany({where:{active:true},select:{intent_code:true,phrase:true,normalized:true},take:5001})]);
    if(examples.length>5000)throw new BadRequestException('Assistant example limit reached; retire unused aliases.');
    this.router=new IntentRouter(examples,new Set(configs.filter(c=>c.active&&INTENT_MAP.has(c.code)).map(c=>c.code)));this.loaded=Date.now();
  }
  async route(message:string){if(!this.router||Date.now()-this.loaded>5000)await this.reload();return this.router!.route(message);}
  async intents(){
    const [configs,examples,usage]=await Promise.all([this.db.assistantIntentConfig.findMany(),this.db.assistantExample.groupBy({by:['intent_code'],where:{active:true},_count:{_all:true}}),this.db.assistantQueryLog.groupBy({by:['intent_code','status'],where:{created_at:{gte:new Date(Date.now()-30*86400000)}},_count:{_all:true}})]);
    return INTENTS.map(i=>{const counts=usage.filter(u=>u.intent_code===i.code),count=counts.reduce((s,u)=>s+u._count._all,0),success=counts.filter(u=>u.status==='SUCCESS').reduce((s,u)=>s+u._count._all,0);return {code:i.code,name:i.name,category:i.category,permissions:i.permissions,feature:i.feature,entity:i.entity||null,active:configs.find(c=>c.code===i.code)?.active??false,example_count:examples.find(e=>e.intent_code===i.code)?._count._all||0,usage_count:count,success_rate:count?success/count*100:0};});
  }
  examples(query:any){const offset=Math.max(0,Math.min(100000,Number(query.offset)||0));return this.db.assistantExample.findMany({where:{...(query.intent?{intent_code:query.intent}:{}),...(query.language?{language:query.language}:{}),...(query.source?{source:query.source}:{}),...(query.status==='ACTIVE'?{active:true}:query.status==='INACTIVE'?{active:false}:{}),...(query.search?{phrase:{contains:String(query.search).slice(0,100),mode:'insensitive' as const}}:{})},orderBy:[{created_at:'desc'},{id:'asc'}],take:50,skip:offset,select:{id:true,intent_code:true,phrase:true,language:true,source:true,active:true}});}
  async add(userId:string,data:{phrase:string;intent_code:string;language:string},source='ADMIN_ADDED'){
    if(!INTENT_MAP.has(data.intent_code))throw new BadRequestException('Choose a registered intent');
    const phrase=safeQuestion(data.phrase.trim()),normalized=normalize(phrase);
    if(phrase!==data.phrase.trim()||normalized.length<3||normalized.length>400)throw new BadRequestException('Use a safe business phrase without credentials, phone numbers or email');
    const existing=await this.db.assistantExample.findUnique({where:{normalized}});
    if(existing&&existing.intent_code!==data.intent_code)throw new BadRequestException('Phrase already belongs to another intent; deactivate it first and review its mapping.');
    if(!existing&&await this.db.assistantExample.count()>=5000)throw new BadRequestException('Assistant example limit reached');
    const result=await this.db.$transaction(async tx=>{
      const row=await tx.assistantExample.upsert({where:{normalized},create:{...data,phrase,normalized,source},update:{active:true,language:data.language,source}});
      await tx.platformAuditLog.create({data:{user_id:userId,action:'ASSISTANT_EXAMPLE_APPROVED',resource_type:'AssistantExample',resource_id:row.id,details:JSON.stringify({intent:data.intent_code,source})}});return row;
    });await this.reload();return result;
  }
  async active(userId:string,code:string,active:boolean){
    if(!INTENT_MAP.has(code))throw new BadRequestException('Unknown intent');
    await this.db.$transaction([this.db.assistantIntentConfig.update({where:{code},data:{active}}),this.db.platformAuditLog.create({data:{user_id:userId,action:'ASSISTANT_INTENT_STATUS',resource_type:'AssistantIntent',details:JSON.stringify({code,active})}})]);await this.reload();return {code,active};
  }
  async retire(userId:string,id:string){await this.db.$transaction([this.db.assistantExample.update({where:{id},data:{active:false}}),this.db.platformAuditLog.create({data:{user_id:userId,action:'ASSISTANT_EXAMPLE_RETIRED',resource_type:'AssistantExample',resource_id:id}})]);await this.reload();return {success:true};}
}
