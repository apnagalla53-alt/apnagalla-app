import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EntityKind } from './intent-library';
import { AssistantContext,Entity } from './assistant.types';
import { normalize } from './nlp';
@Injectable()
export class EntityResolverService {
  constructor(private db:PrismaService){}
  async find(ctx:AssistantContext,kind:EntityKind,search:string):Promise<Entity[]> {
    if(!search)return [];
    // Conservative commonly used Hindi names are additional search candidates, not rewritten records.
    const hints:Record<string,string>={'रमेश':'Ramesh','मोहन':'Mohan','राहुल':'Rahul','मैगी':'Maggi','चावल':'Rice','पेट्रोल':'Petrol','किराया':'Rent','मुख्य':'Main'};
    const variants=[search,...(hints[search]?[hints[search]]:[])];
    const names=variants.map(s=>({name:{contains:s,mode:'insensitive' as const}}));let rows:{id:string;name:string}[]=[];
    if(kind==='customer'||kind==='supplier')rows=await this.db.party.findMany({where:{company_id:ctx.company_id,party_type:kind==='customer'?'CUSTOMER':'SUPPLIER',is_active:true,OR:names},select:{id:true,name:true},orderBy:[{name:'asc'},{id:'asc'}],take:6});
    if(kind==='item'){
      rows=await this.db.item.findMany({where:{company_id:ctx.company_id,is_system:false,is_active:true,OR:names},select:{id:true,name:true},orderBy:[{name:'asc'},{id:'asc'}],take:6});
      if(!rows.length){const tokens=search.split(' ').slice(0,8),parts=new Set<string>();for(let i=1;i<tokens.length;i++){parts.add(tokens.slice(0,i).join(' '));parts.add(tokens.slice(i).join(' '));}
        if(parts.size)rows=await this.db.item.findMany({where:{company_id:ctx.company_id,is_active:true,is_system:false,has_variants:true,OR:[...parts].map(name=>({name:{equals:name,mode:'insensitive' as const}}))},select:{id:true,name:true},take:6,orderBy:{id:'asc'}});
      }
    }
    if(kind==='staff')rows=(await this.db.user.findMany({where:{organization_id:ctx.organization_id,is_active:true,OR:variants.map(s=>({display_name:{contains:s,mode:'insensitive' as const}})),roles:{some:{company_id:ctx.company_id,OR:[{branch_id:ctx.branch_id},{branch_id:null}]}}},select:{id:true,display_name:true},orderBy:{id:'asc'},take:6})).map(u=>({id:u.id,name:u.display_name}));
    if(kind==='category')rows=await this.db.expenseCategory.findMany({where:{company_id:ctx.company_id,OR:names},select:{id:true,name:true},orderBy:{id:'asc'},take:6});
    if(kind==='location')rows=await this.db.godown.findMany({where:{branch_id:ctx.branch_id,branch:{company_id:ctx.company_id},OR:names},select:{id:true,name:true},orderBy:{id:'asc'},take:6});
    if(kind==='bill')rows=(await this.db.salesInvoice.findMany({where:{company_id:ctx.company_id,branch_id:ctx.branch_id,status:'POSTED',document_number:{equals:search,mode:'insensitive'}},select:{id:true,document_number:true},take:6})).map(b=>({id:b.id,name:b.document_number}));
    const exact=rows.filter(r=>variants.some(v=>normalize(r.name,false)===normalize(v,false)));
    return (exact.length?exact:rows).map(r=>({kind,id:r.id,name:r.name}));
  }
  async verify(ctx:AssistantContext,entity:Entity){return (await this.find(ctx,entity.kind,entity.name)).some(e=>e.id===entity.id);}
}
