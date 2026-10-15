import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException, ConflictException } from '@nestjs/common';
import { from, lastValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';

function canonical(value:any):string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private db:PrismaService) {}
  intercept(context:ExecutionContext,next:CallHandler) {
    const req=context.switchToHttp().getRequest();
    const path=req.path;
    const financial=/\/retail\/(bills(?:\/amount-sale|\/return)?|purchases|expenses|(?:customers|suppliers)\/[0-9a-f-]+\/payments)$/.test(path)
      || /\/erp\/pos\/(sale|return)$/.test(path);
    const intakeConfirm=/\/retail\/account\/intake\/[0-9a-f-]+\/confirm$/.test(path);
    const entityCreate=/\/retail\/(?:items(?:\/inline|\/bulk)?|customers|suppliers)$/.test(path);
    if(req.method!=='POST'||(!financial&&!entityCreate&&!intakeConfirm)||!req.user) return next.handle();
    const key=req.headers['idempotency-key'];
    if(!key) {
      if(process.env.NODE_ENV==='production') throw new BadRequestException('Idempotency-Key is required for financial writes');
      return next.handle();
    }
    if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new BadRequestException('Invalid Idempotency-Key');
    const fingerprint=createHash('sha256').update(canonical({method:req.method,path,body:req.body,branch:req.user.branch_id,fy:req.user.financial_year_id})).digest('hex');
    return from(this.db.runAtomic(async()=>{
      await this.db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${req.user.company_id+':'+key},0))::text`;
      const previous=await this.db.requestIdempotency.findUnique({where:{company_id_key:{company_id:req.user.company_id,key}}});
      if(previous) {
        if(previous.fingerprint!==fingerprint) throw new ConflictException('This request key was already used with different data');
        context.switchToHttp().getResponse().setHeader('Idempotency-Replayed','true');
        return previous.response;
      }
      const response=await lastValueFrom(next.handle());
      const safe=JSON.parse(JSON.stringify(response));
      await this.db.requestIdempotency.create({data:{company_id:req.user.company_id,key,fingerprint,response:safe,user_id:req.user.id}});
      return response;
    }));
  }
}
