import {CallHandler,ExecutionContext,Injectable,NestInterceptor} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {map} from 'rxjs/operators';
import {PrismaService} from '../database/prisma.service';
import {EntitlementService} from './entitlement.service';
const privateFields=new Set(['cogs_total','cogs','cost_per_base_unit','cost_rate','value_delta','unknown_quantity_delta','gross_profit','net_business_profit','gross_margin','cost_coverage','cost_snapshot','cost_status','net_revenue','inventory_value','average_cost','known_value','unknown_quantity','cost_state','inventory_cost_states']);
export function hideFinancialCosts(value:any):any{
  if(value==null||typeof value!=='object'||value instanceof Date||value instanceof Prisma.Decimal)return value;
  if(Array.isArray(value))return value.map(hideFinancialCosts);
  return Object.fromEntries(Object.entries(value).filter(([key])=>!privateFields.has(key)).map(([key,v])=>[key,hideFinancialCosts(v)]));
}
@Injectable()
export class FinancialCostVisibilityInterceptor implements NestInterceptor{
 constructor(private db:PrismaService){}
 async intercept(context:ExecutionContext,next:CallHandler){
  const user=context.switchToHttp().getRequest().user;
  const permitted=['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role)||user?.permissions?.includes('reports.read');
  const effective=permitted?await new EntitlementService(this.db).resolve(user.organization_id,this.db,user.company_id):null;
  const allowed=permitted&&['REPORTS','PROFIT_REPORTING'].every(code=>effective?.features.some(f=>f.code===code&&f.enabled));
  return next.handle().pipe(map(value=>allowed?value:hideFinancialCosts(value)));
 }
}
