import {describe,it,expect} from 'vitest';
import {calculate} from '../../src/retail/billing/calculator';
import {receiptMessage} from '../../src/retail/payments/whatsapp';
describe('Bill calculator',()=>{
 it.each([['10+20*3','70'],['(10+20)*3','90'],['400*10%','40'],['.1+.2','0.3'],['10÷4','2.5'],['-5+2','-3'],['.000001*.000001','0.000000000001'],['0.000000000001+1','1.000000000001']])('calculates %s', (expression,value)=>expect(calculate(expression)).toBe(value));
 it.each(['1/0','alert(1)','1+','1..2','1e309','()','2**3'])('rejects invalid calculation %s',expression=>expect(()=>calculate(expression)).toThrow());
});
describe('Short, invoice-specific Udhar message',()=>{
 it('identifies the actual bill balance without exposing a long item list',()=>{const message=receiptMessage({document_number:'EPS-021',document_date:'2026-10-17',party:{name:'Rahul'},grand_total:1000,paid_amount:400,outstanding_amount:600,sales_invoice_line:Array(100).fill({item:{name:'Long detailed product'}})},'Ezzy Paints');expect(message).toContain('Namaste Rahul ji');expect(message).toContain('EPS-021');expect(message).toContain('Is bill ka baaki: ₹600.00');expect(message).not.toContain('Long detailed product');expect(message.length).toBeLessThan(240);});
});
