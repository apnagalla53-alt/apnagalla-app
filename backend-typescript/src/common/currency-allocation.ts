import {Prisma} from '@prisma/client';
import {BadRequestException} from '@nestjs/common';
/** Allocate currency exactly, with stable input-order ties and no negative residual. */
export function allocateCurrency(amount:Prisma.Decimal.Value,weights:Prisma.Decimal.Value[]){
 const total=new Prisma.Decimal(amount).toDecimalPlaces(2),basis=weights.reduce<Prisma.Decimal>((s,w)=>s.plus(w),new Prisma.Decimal(0));
 if(total.lt(0)||weights.some(w=>new Prisma.Decimal(w).lt(0))||basis.lte(0))throw new BadRequestException('Allocation requires non-negative amount and positive weights');
 const parts=weights.map((w,index)=>{const exact=total.mul(w).div(basis),share=exact.toDecimalPlaces(2,Prisma.Decimal.ROUND_DOWN);return{index,share,fraction:exact.minus(share)};});
 let cents=total.minus(parts.reduce((s,p)=>s.plus(p.share),new Prisma.Decimal(0))).mul(100).toNumber();
 for(const part of [...parts].sort((a,b)=>b.fraction.comparedTo(a.fraction)||a.index-b.index)){if(cents<=0)break;part.share=part.share.plus('.01');cents--;}
 if(cents!==0)throw new BadRequestException('Allocation exceeded supported currency precision');
 return parts.map(p=>p.share);
}
