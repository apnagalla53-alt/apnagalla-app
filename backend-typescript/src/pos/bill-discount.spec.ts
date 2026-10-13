import {Prisma} from '@prisma/client';
import {allocateBillDiscount} from './bill-discount';
describe('Currency-exact bill discount allocation',()=>{
 const lines=(values:number[],tax=0)=>values.map(value=>({taxable_value:new Prisma.Decimal(value),tax_amount:new Prisma.Decimal(value).mul(tax).div(100),line_total:new Prisma.Decimal(value).mul(1+tax/100),discount_amount:new Prisma.Decimal(0)}));
 it('allocates one paisa deterministically across equal lines',()=>{const l=lines([1,1,1]);expect(allocateBillDiscount(l,'.01').map(v=>v.toString())).toEqual(['0.01','0','0']);expect(l.reduce((s,v)=>s.plus(v.taxable_value),new Prisma.Decimal(0)).toString()).toBe('2.99');});
 it('fully discounts a sale without negative line revenue or Output GST',()=>{const l=lines([1,2,3],18);allocateBillDiscount(l,6);for(const v of l){expect(v.taxable_value.toString()).toBe('0');expect(v.tax_amount.toString()).toBe('0');}});
 it('allocates proportional discounts before Output GST',()=>{const l=lines([100,50],18);allocateBillDiscount(l,30);expect(l.map(v=>v.line_total.toString())).toEqual(['94.4','47.2']);});
 it('rejects a discount above the net sale basis',()=>{expect(()=>allocateBillDiscount(lines([1,2]),4)).toThrow('exceeds');});
});
