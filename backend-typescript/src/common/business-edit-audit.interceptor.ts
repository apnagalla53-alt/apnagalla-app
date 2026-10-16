import { CallHandler,ExecutionContext,Injectable,NestInterceptor } from '@nestjs/common';
import { defer,lastValueFrom } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
const resources:Record<string,string>={items:'item',customers:'party',suppliers:'party',purchases:'purchaseInvoice',expenses:'expense',needs:'needList'};
/** Capture successful record corrections in the same transaction as the change. */
@Injectable()
export class BusinessEditAuditInterceptor implements NestInterceptor {
  constructor(private db:PrismaService){}
  intercept(context:ExecutionContext,next:CallHandler){
    const req=context.switchToHttp().getRequest(),match=req.path.match(/\/retail\/(items|customers|suppliers|purchases|expenses|needs)\/([a-f0-9-]{36})(?:\/|$)/i);
    const postEdit=req.method==='POST'&&/\/retail\/(items|customers|suppliers|purchases|expenses|needs)\/[a-f0-9-]{36}(?:\/(?:remove|archive|delete|update))?\/?$/i.test(req.path);
    if(!req.user?.company_id||!match||!['PUT','PATCH','DELETE'].includes(req.method)&&!postEdit)return next.handle();
    return defer(()=>this.db.runAtomic(async()=>{
      const [resource,id]=match.slice(1),delegate=(this.db as any)[resources[resource]],where={id,company_id:req.user.company_id};
      const before=await delegate.findFirst({where}),result=await lastValueFrom(next.handle()),after=await delegate.findFirst({where});
      if(before){const name=String(req.headers['x-correction-name']||req.user.name||req.user.username).trim().slice(0,100),reason=String(req.headers['x-correction-reason']||'Record updated').trim().slice(0,1000);
        await this.db.auditLog.create({data:{company_id:req.user.company_id,branch_id:req.user.branch_id,user_id:req.user.id,action:resource.toUpperCase()+'_CORRECTED',source_document_type:resource.toUpperCase(),source_document_id:id,details:JSON.stringify({editor_name:name,reason,before,after})}});
      }return result;
    }));
  }
}
