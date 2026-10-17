import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Explicit retail GST is an invoice snapshot, never a change to item master tax. */
export function saleGstRate(line:{gst_rate?:number}, itemRate:any) {
  const rate=Number(line.gst_rate ?? itemRate ?? 0);
  if(!Number.isFinite(rate)||rate<0||rate>100)throw new BadRequestException('Enter a GST percentage between 0 and 100');
  return new Prisma.Decimal(rate);
}
export function billDiscountValue(lines:{taxable_value:any}[],dto:{bill_discount?:number;bill_discount_percent?:number}) {
  if(dto.bill_discount_percent!==undefined){
    if(!Number.isFinite(dto.bill_discount_percent)||dto.bill_discount_percent<0||dto.bill_discount_percent>100||Number(dto.bill_discount)>0)throw new BadRequestException('Choose one valid amount or percentage discount');
    return lines.reduce((sum,line)=>sum.plus(line.taxable_value),new Prisma.Decimal(0)).mul(dto.bill_discount_percent).div(100).toDecimalPlaces(2);
  }
  const amount=new Prisma.Decimal(dto.bill_discount||0);
  if(!amount.isFinite()||amount.lt(0))throw new BadRequestException('Enter a valid discount');
  return amount;
}
