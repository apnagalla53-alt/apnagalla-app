import { Injectable,NotFoundException,ConflictException,BadRequestException,ForbiddenException } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../database/prisma.service';
import { AssistantCatalogService } from './assistant-catalog.service';
import { AssistantToolRegistry } from './tool-registry.service';
import { EntityResolverService } from './entity-resolver.service';
import { AssistantContext,AssistantReply,ConversationState,Language,QueryContext,Routing } from './assistant.types';
import { INTENT_MAP,EntityKind } from './intent-library';
import { dateRange,normalize,safeQuestion,stripDates } from './nlp';
import { extractEntity } from './entity-parser';
import { renderAnswer } from './response-template';
import { throttleOperation } from '../common/operation-throttle';
import { EntitlementService } from '../common/entitlement.service';
export interface Question {message:string;session_id?:string;session_version?:number;language?:Language;channel?:'TEXT'|'VOICE';}
@Injectable()
export class AssistantService {
  constructor(private db:PrismaService,private catalog:AssistantCatalogService,private tools:AssistantToolRegistry,private entities:EntityResolverService,private entitlements:EntitlementService){}
  async query(user:any,dto:Question):Promise<AssistantReply>{
    if(dto.channel==='VOICE') {
      await this.entitlements.require(user.organization_id,['ASSISTANT_VOICE'],user.company_id);
      throw new BadRequestException({code:'VOICE_NOT_CONFIGURED',message:'A supported voice provider is not configured. Use text Ask EVOLIX.'});
    }
    await throttleOperation('assistant:'+user.id,180);
    const start=performance.now(),timings:Record<string,number>={normalization_ms:0,routing_ms:0,entity_resolution_ms:0,permission_ms:0,tool_execution_ms:0,template_ms:0,total_ms:0};
    const company=await this.db.company.findFirstOrThrow({where:{id:user.company_id,organization_id:user.organization_id},select:{timezone:true}});
    const branch=user.branch_id||(await this.db.branch.findFirst({where:{company_id:user.company_id,is_active:true},orderBy:{created_at:'asc'},select:{id:true}}))?.id;
    if(!branch)throw new BadRequestException('Choose a shop store first');
    const ctx:AssistantContext={...user,branch_id:branch,timezone:company.timezone};
    const scope={company_id:ctx.company_id,branch_id:ctx.branch_id,user_id:ctx.id,auth_session_id:ctx.session_id};
    let session=dto.session_id?await this.db.assistantConversation.findFirst({where:{id:dto.session_id,...scope,expires_at:{gt:new Date()}}}):await this.db.assistantConversation.create({data:{...scope,expires_at:new Date(Date.now()+15*60000)}});
    if(!session)throw new NotFoundException('Conversation expired or is unavailable. Start a new conversation.');
    if(dto.session_id&&dto.session_version===undefined)throw new BadRequestException('Conversation version is required');
    const expected=dto.session_version??session.version;
    const claim=await this.db.assistantConversation.updateMany({where:{id:session.id,...scope,version:expected},data:{version:{increment:1},expires_at:new Date(Date.now()+15*60000)}});
    if(!claim.count)throw new ConflictException('Another question changed this conversation. Start a new conversation or retry with the latest response.');
    let state=(session.context||{}) as unknown as ConversationState;
    const language=dto.language||(/[\u0900-\u097f]/.test(dto.message)?'hi':'hinglish');
    let routing:Routing={intent:null,confidence:0,router:'UNKNOWN'},query:QueryContext|undefined;
    let response:Omit<AssistantReply,'session_id'|'session_version'|'generated_at'|'timings'|'routing'>={status:'UNKNOWN',text:language==='hi'?'इस सवाल को अभी समझ नहीं पाया। बिक्री, गल्ला, स्टॉक या उधार के बारे में पूछिए।':language==='en'?'I could not recognize that question yet. Ask about sales, Galla, stock or dues.':'Main is sawaal ko abhi samajh nahi paaya. Sale, galla, stock ya udhar ke baare mein poochhiye.'};
    let activeTimer=performance.now();
    try{
      const normalized=normalize(dto.message);timings.normalization_ms=performance.now()-activeTimer;activeTimer=performance.now();
      const choice=normalized.match(/^[1-6]$/);
      if(choice&&state.pending?.choices.length){
        const selected=state.pending.choices[Number(normalized)-1];if(!selected)throw new BadRequestException('Choose one of the listed options');
        query={...state.pending.query,...(selected.entity?{entity:selected.entity}:{}),...(selected.itemEntity?{itemEntity:selected.itemEntity}:{}),...(selected.intent?{intent:selected.intent}:{}),...(selected.variantId?{variantId:selected.variantId}:{}),...(selected.unitId?{unitId:selected.unitId}:{})};
        routing={intent:query.intent,confidence:1,router:'CONTEXT'};state.pending=undefined;
      }else if(state.pending&&!state.pending.choices.length){
        query={...state.pending.query,search:extractEntity(dto.message,INTENT_MAP.get(state.pending.query.intent)!.entity!).search};routing={intent:query.intent,confidence:1,router:'CONTEXT'};state.pending=undefined;
      }else if(/^(?:aur dikhao|aur|show more|more|और दिखाओ|और)$/.test(normalized)&&state.last){query={...state.last,offset:state.last.offset+5};routing={intent:query.intent,confidence:1,router:'CONTEXT'};}
      else if(/^(?:uska khata(?: dikhao)?|their ledger|उसका खाता(?: दिखाओ)?)$/.test(normalized)&&state.last?.entity&&['customer','supplier'].includes(state.last.entity.kind)){query={...state.last,intent:state.last.entity.kind==='customer'?'CUSTOMER_KHATA':'SUPPLIER_KHATA',offset:0};routing={intent:query.intent,confidence:1,router:'CONTEXT'};}
      else{
        const dates=dateRange(dto.message,ctx.timezone);
        const asksMonthToDate=/\b(?:this month|is month|is mahine)\b|इस महीने/.test(normalized),asksWeekToDate=/\b(?:this week|is hafte)\b|इस हफ्ते/.test(normalized);
        if(asksMonthToDate){const current=dateRange('this month',ctx.timezone);dates.from=current.from;dates.to=current.to;dates.label=current.label;dates.explicit=true;dates.comparison_mode='MONTH_TO_DATE';}
        else if(asksWeekToDate){const current=dateRange('this week',ctx.timezone);dates.from=current.from;dates.to=current.to;dates.label=current.label;dates.explicit=true;dates.comparison_mode='WEEK_TO_DATE';}
        const remaining=stripDates(normalized).trim();
        if(dates.explicit&&/^(?:ka|ki|and|aur|then|का|की)?$/.test(remaining)&&state.last){query={...state.last,dates,offset:0};routing={intent:query.intent,confidence:1,router:'CONTEXT'};}
        else {routing=await this.catalog.route(dto.message);if(routing.intent)query={intent:routing.intent,dates,offset:0};}
        state.pending=undefined;
      }
      timings.routing_ms=performance.now()-activeTimer;
      if(!query&&routing.alternatives?.length){
        const choices=routing.alternatives.filter(code=>this.tools.permitted(ctx,code)).map(intent=>({label:INTENT_MAP.get(intent)!.name,intent}));
        if(choices.length){const base={intent:choices[0].intent,dates:dateRange(dto.message,ctx.timezone),offset:0,search:extractEntity(dto.message,INTENT_MAP.get(choices[0].intent)!.entity||'item').search};state.pending={query:base,choices};response={status:'AMBIGUOUS',text:language==='hi'?'कौन सा विवरण चाहिए?':language==='en'?'Which business detail did you mean?':'Kaunsa business detail chahiye?',choices:choices.map((c,i)=>({label:c.label,value:String(i+1)}))};}
      }
      if(query){
        if(!await this.db.assistantIntentConfig.findFirst({where:{code:query.intent,active:true}}))throw new BadRequestException('This Assistant intent is currently disabled');
        const def=INTENT_MAP.get(query.intent);if(!def)throw new BadRequestException('Tool is unavailable');
        activeTimer=performance.now();await this.tools.authorize(ctx,query.intent);timings.permission_ms=performance.now()-activeTimer;
        activeTimer=performance.now();
        if(query.entity&&!await this.entities.verify(ctx,query.entity))throw new NotFoundException('Selected record is no longer available');
        if(query.itemEntity&&!await this.entities.verify(ctx,query.itemEntity))throw new NotFoundException('Selected item is no longer available');
        if(def.entity&&!query.entity){
          const parsed=extractEntity(dto.message,def.entity);query={...query,...parsed,search:query.search??parsed.search};
          if(query.intent==='LOCATION_STOCK'){const parts=normalize(dto.message,false).match(/^(.+?)\s+(?:mein|me|में)\s+(.+)$/);if(parts){query.search=parts[1].trim();query.itemSearch=extractEntity(parts[2],'item').search;}}
          if(!query.search){state.pending={query,choices:[]};response={status:'AMBIGUOUS',text:language==='hi'?`${def.entity} का नाम बताइए।`:language==='en'?`What is the ${def.entity} name?`:`${def.entity} ka naam batayein.`,period:query.dates};}
          else{
            let candidates=await this.entities.find(ctx,def.entity,query.search);
            // Resolve role ambiguity against this shop only; never infer that a person is staff/customer globally.
            if(routing.alternatives?.length&&!/customer|supplier|staff|ग्राहक|सप्लायर|कर्मचारी/.test(normalized)){
              for(const [kind,intent] of [['supplier','SUPPLIER_BALANCE'],['staff','STAFF_SALES']] as [EntityKind,string][]){
                if(kind===def.entity||!this.tools.permitted(ctx,intent))continue;
                try{await this.tools.authorize(ctx,intent);const extra=await this.entities.find(ctx,kind,query.search);candidates.push(...extra);}catch(error){if(!(error instanceof ForbiddenException))throw error;}
              }
            }
            if(candidates.length===1){query.entity=candidates[0];if(query.entity.kind==='staff')query.intent='STAFF_SALES';if(query.entity.kind==='supplier'&&def.entity!=='supplier')query.intent='SUPPLIER_BALANCE';}
            else if(candidates.length>1){
              const choices=candidates.slice(0,5).map(entity=>({label:`${entity.name} · ${entity.kind}`,entity,intent:entity.kind==='staff'?'STAFF_SALES':entity.kind==='supplier'&&def.entity!=='supplier'?'SUPPLIER_BALANCE':query!.intent}));
              state.pending={query,choices};response={status:'AMBIGUOUS',text:candidates.length>5?'More than five matches. Choose one or start a new question with the full name.':language==='hi'?'कौन सा रिकॉर्ड चाहिए?':language==='en'?'Which record did you mean?':'Kaunsa record chahiye?',period:query.dates,choices:choices.map((c,i)=>({label:c.label,value:String(i+1)}))};
            }else response={status:'NOT_FOUND',text:language==='hi'?'इस दुकान में उस नाम का रिकॉर्ड नहीं मिला।':language==='en'?'No matching record was found in this shop.':'Is shop mein is naam ka record nahi mila.',period:query.dates};
          }
        }
        if(query.intent==='LOCATION_STOCK'&&query.entity&&query.itemSearch&&!query.itemEntity&&!state.pending){
          const candidates=await this.entities.find(ctx,'item',query.itemSearch);
          if(!candidates.length)throw new NotFoundException('Item unavailable in this shop');
          if(candidates.length===1)query.itemEntity=candidates[0];
          else{const choices=candidates.slice(0,5).map(itemEntity=>({label:itemEntity.name,itemEntity}));state.pending={query,choices};response={status:'AMBIGUOUS',text:'Which item at this location?',period:query.dates,choices:choices.map((c,i)=>({label:c.label,value:String(i+1)}))};}
        }
        // Variant choice is explicit; an aggregate is labeled rather than guessing a colour/size.
        if(query.entity?.kind==='item'&&query.intent==='ITEM_STOCK'&&!query.variantId&&!state.pending){
          const item=await this.db.item.findFirst({where:{id:query.entity.id,company_id:ctx.company_id},select:{has_variants:true}});
          if(item?.has_variants){const leftover=(query.search||'').replace(normalize(query.entity.name,false),'').trim();
            const all=await this.db.itemVariant.findMany({where:{item_id:query.entity.id,is_active:true},select:{id:true,attributes:true,sku:true},orderBy:{id:'asc'},take:101});
            if(all.length>100)throw new BadRequestException('Ask using the exact item and variant in the Items page; more than 100 variants are configured.');
            const variants=leftover?all.filter(v=>Object.values(v.attributes as object).some(value=>normalize(String(value),false)===leftover)||normalize(v.sku||'',false)===leftover):all;
            if(leftover&&!variants.length)throw new BadRequestException('That variant is not configured for this item.');
            if(leftover&&variants.length===1){query.variantId=variants[0].id;}
            else{
            const choices=[...variants.slice(0,5).map(v=>({label:Object.values(v.attributes as object).join(' / ')||v.sku||'Variant',variantId:v.id})),{label:'All variants combined',variantId:'ALL'}];state.pending={query,choices};response={status:'AMBIGUOUS',text:variants.length>5?'Choose a displayed variant, ask with its exact name, or view combined stock.':'Choose a variant, or view the combined stock.',period:query.dates,choices:choices.map((c,i)=>({label:c.label,value:String(i+1)}))};
            }
          }
        }
        timings.entity_resolution_ms=performance.now()-activeTimer;
        if(!state.pending&&(!def.entity||query.entity)){
          routing={...routing,intent:query.intent};
          activeTimer=performance.now();const result=await this.tools.execute(ctx,query);timings.tool_execution_ms=performance.now()-activeTimer;
          if(result.insight){timings.diagnosis_driver_count=result.insight.drivers.length;timings.diagnosis_insufficient=result.insight.confidence==='INSUFFICIENT'?1:0;timings.diagnosis_cost_limited=result.insight.confidence==='LIMITED'?1:0;}
          activeTimer=performance.now();response={status:'SUCCESS',text:renderAnswer(query,result,language),period:query.dates,result};timings.template_ms=performance.now()-activeTimer;
          state.last=query;state.pending=undefined;
        }
      }
    }catch(error){
      state.pending=undefined;
      const entitlementError=error instanceof ForbiddenException?error.getResponse() as any:null;
      response=entitlementError?.code==='FEATURE_NOT_ENTITLED'?{status:'FEATURE_NOT_ENTITLED',text:language==='hi'?`यह सुविधा ${entitlementError.required_plan==='PRO'?'Pro':'Smart'} प्लान में उपलब्ध है। Shop Features से प्लान देखें।`:`This feature is available in ${entitlementError.required_plan==='PRO'?'Pro':'Smart'}. Open Shop Features to review your plan.`}:error instanceof ForbiddenException?{status:'PERMISSION_DENIED',text:language==='hi'?'आपके खाते को इस जानकारी की अनुमति नहीं है।':language==='en'?'Your account does not have permission for this information.':'Aapke account ko is information ki permission nahi hai.'}:error instanceof NotFoundException?{status:'NOT_FOUND',text:'That record is unavailable in this shop. Start a new question.'}:{status:'ERROR',text:error instanceof BadRequestException?error.message:'Could not read your business records. Please retry.'};
    }
    const saved=await this.db.assistantConversation.updateMany({where:{id:session.id,...scope,version:expected+1},data:{context:state as any}});
    if(!saved.count)throw new ConflictException('Conversation changed while processing. Start a new conversation.');
    timings.total_ms=performance.now()-start;
    const safe=safeQuestion(dto.message);
    await this.db.assistantQueryLog.create({data:{company_id:ctx.company_id,branch_id:ctx.branch_id,user_id:ctx.id,original_message:safe,normalized_message:normalize(safe),intent_code:routing.intent,confidence:routing.confidence,router_type:routing.router,status:response.status,timings,total_ms:timings.total_ms}});
    return {...response,routing:{intent:routing.intent,confidence:routing.confidence,router:routing.router},session_id:session.id,session_version:expected+1,generated_at:new Date().toISOString(),timings};
  }
}
