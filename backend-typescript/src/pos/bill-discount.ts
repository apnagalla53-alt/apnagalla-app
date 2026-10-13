import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Largest-remainder allocation after line discounts, before Output GST. */
export function allocateBillDiscount(lines:{taxable_value:any;tax_amount:any;line_total:any;discount_amount?:any}[],amount:any) {
  const discount=new Prisma.Decimal(amount||0).toDecimalPlaces(2);
  if(discount.eq(0))return lines.map(()=>new Prisma.Decimal(0));
  const basis=lines.reduce((s,l)=>s.plus(l.taxable_value),new Prisma.Decimal(0));
  if(discount.lt(0)||discount.gt(basis))throw new BadRequestException('Bill discount exceeds eligible net sale value');
  const shares=lines.map((l,index)=>{const exact=discount.mul(l.taxable_value).div(basis);const share=exact.toDecimalPlaces(2,Prisma.Decimal.ROUND_DOWN);return{index,share,fraction:exact.minus(share)};});
  let remaining=discount.minus(shares.reduce((s,p)=>s.plus(p.share),new Prisma.Decimal(0)));
  for(const part of [...shares].sort((a,b)=>b.fraction.comparedTo(a.fraction)||a.index-b.index)){
    if(remaining.eq(0))break;if(new Prisma.Decimal(lines[part.index].taxable_value).minus(part.share).gte('0.01')){part.share=part.share.plus('0.01');remaining=remaining.minus('0.01');}
  }
  if(!remaining.eq(0))throw new BadRequestException('Discount cannot be allocated at currency precision');
  for(const p of shares){const l=lines[p.index],old=new Prisma.Decimal(l.taxable_value),tax=new Prisma.Decimal(l.tax_amount);
    l.taxable_value=old.minus(p.share);l.tax_amount=old.eq(0)?tax:tax.mul(l.taxable_value).div(old).toDecimalPlaces(2);
    l.line_total=l.taxable_value.plus(l.tax_amount);l.discount_amount=new Prisma.Decimal(l.discount_amount||0).plus(p.share);}
  return shares.map(p=>p.share);
}
