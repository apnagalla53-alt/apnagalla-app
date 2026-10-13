import { EntityKind } from './intent-library';
export type Language='en'|'hinglish'|'hi';
export interface DateRange {from:string;to:string;timezone:string;label:string;explicit:boolean;comparison_mode?:'MONTH_TO_DATE'|'WEEK_TO_DATE';}
export interface Routing {intent:string|null;confidence:number;router:'EXACT'|'PATTERN'|'FUZZY'|'CONTEXT'|'UNKNOWN';matched?:string;alternatives?:string[];}
export interface AssistantContext {id:string;session_id:string;company_id:string;branch_id:string;organization_id:string;role:string;permissions:string[];timezone:string;}
export interface Entity {kind:EntityKind;id:string;name:string;}
export interface QueryContext {intent:string;dates:DateRange;entity?:Entity;itemEntity?:Entity;itemSearch?:string;search?:string;offset:number;quantity?:number;variantSearch?:string;unitSearch?:string;variantId?:string;unitId?:string;}
export interface InsightDriver {type:string;title:string;target_metric:string;current_value:string|number|null;previous_value:string|number|null;absolute_change:string|number|null;percentage_change:number|null;impact_amount:number|null;severity:'HIGH'|'MEDIUM'|'LOW';evidence_type:'DIRECT'|'CORRELATED'|'ESTIMATED';supporting_metrics:Record<string,string|number|null>;description:string;}
export interface BusinessInsight {current_period:{from:string;to:string};comparison_period:{from:string;to:string};delta:number|null;change_percent:number|null;metric:string;drivers:InsightDriver[];follow_ups:string[];confidence:'HIGH'|'LIMITED'|'INSUFFICIENT';}
export interface Result {title:string;summary:Record<string,string|number|null>;rows?:Record<string,string|number|null>[];hasMore?:boolean;definition:string;link?:string;empty?:boolean;insight?:BusinessInsight;}
export interface ConversationState {last?:QueryContext;pending?:{query:QueryContext;choices:{label:string;entity?:Entity;itemEntity?:Entity;intent?:string;variantId?:string;unitId?:string}[]};}
export interface AssistantReply {status:string;text:string;routing:Routing;period?:DateRange;result?:Result;choices?:{label:string;value:string}[];session_id:string;session_version:number;generated_at:string;timings:Record<string,number>;}
