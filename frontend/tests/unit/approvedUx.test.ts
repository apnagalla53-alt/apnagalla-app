import { describe,it,expect } from 'vitest';
import { formatDate,formatTime,formatDateTime } from '../../src/shared/dateFormat';
import { readUpiQr } from '../../src/retail/payments/readUpiQr';
import { safeReturnTo } from '../../src/retail/components/returnNavigation';
import { gstInputError,gstInputMode } from '../../src/retail/gst/gstInput';
import { bulkRowError, isEmptyBulkRow } from '../../src/retail/experience/bulkRows';
it('keeps overlarge bulk values out of the request and accepts zero price and unknown stock',()=>{
 const row={name:'Tea',price:'0',stock:''};
 expect(bulkRowError(row)).toBe('');
 expect(bulkRowError({...row,stock:'1000000000'})).toContain('Stock quantity is too large');
 expect(bulkRowError({...row,price:'1000000000'})).toContain('Selling price is too large');
 expect(bulkRowError({...row,stock:'-1'})).toContain('valid stock quantity');
 expect(bulkRowError({...row,price:'1e100'})).toContain('too large');
 expect(bulkRowError({...row,price:'Infinity'})).toContain('valid selling price');
 expect(bulkRowError({...row,stock:'999999999.999999',price:'999999999.999999'})).toBe('');
});
it('saves the two entered bulk rows while leaving two completely blank rows out',()=>{const blank={name:'',price:'',stock:'',unit:{code:'PCS'}},rows=[{...blank,name:'Tea',price:'20'},{...blank,name:'Free sample',price:'0'},blank,{...blank}];expect(rows.filter(row=>!isEmptyBulkRow(row))).toHaveLength(2);expect(isEmptyBulkRow({...blank,price:'12'})).toBe(false);expect(isEmptyBulkRow({...blank,unit:{code:'KG'}})).toBe(false);});
describe('Shopkeeper dates and actual saved receipt time',()=>{
 it('keeps date-only business dates and displays DD/MM/YYYY',()=>{expect(formatDate('2026-10-16')).toBe('16/10/2026');expect(formatDate('2026-10-16T00:00:00.000Z')).toBe('16/10/2026');expect(formatDate('invalid')).toBe('—');});
 it('uses the real transaction time in India, including across midnight',()=>{expect(formatTime('2026-10-16T10:24:00.000Z')).toMatch(/03:54\s*pm/i);expect(formatDateTime('2026-10-15T20:30:00.000Z')).toMatch(/16\/10\/2026.*02:00\s*am/i);});
});
describe('Receiving QR parsing',()=>{
 it('extracts only the receiving address and unverified displayed name',()=>{expect(readUpiQr('upi://pay?pa=shop%40bank&pn=Shop%20Owner&am=999&tr=one-off&url=https%3A%2F%2Fexample.com')).toEqual({upi_id:'shop@bank',payee_name:'Shop Owner'});});
 it.each(['https://example.com/?pa=shop@bank','upi://pay?pa=one@bank&pa=two@bank','upi://pay?pa=shop@bank&pn=One&pn=Two','upi://pay?pa=shop@bank&cu=USD','upi://pay?pa=missinghandle','upi://user@pay?pa=shop@bank','upi://pay/other?pa=shop@bank','upi://pay?pa=shop@bank&pn=%00Injected'])('rejects unsafe or ambiguous QR %s',value=>expect(()=>readUpiQr(value)).toThrow());
});
describe('Setup return navigation',()=>{
 it('returns to the exact local transaction with its query string',()=>{expect(safeReturnTo({returnTo:'/retail/payment?gst=1'})).toBe('/retail/payment?gst=1');});
 it.each(['https://example.com','//example.com','/retail/\\example.com','/retail/\nmalformed','/platform/admin'])('rejects external or non-retail return %s',returnTo=>expect(safeReturnTo({returnTo})).toBe('/retail/home'));
});
describe('GST entry help',()=>{
 it('gives a clear length error for the reported 14-character entry',()=>expect(gstInputError('07AAECR2971C1Z','23')).toContain('15 characters'));
 it('accepts a valid checked GSTIN and detects a mismatched state',()=>{expect(gstInputError('27AAPFU0939F1ZV','27')).toBe('');expect(gstInputError('27AAPFU0939F1ZV','23')).toContain('matching registered state');expect(gstInputError('27AAPFU0939F1Z0','27')).toContain('check digit');});
 it('suggests numeric keys for state and PAN digits, text for letters',()=>{expect(gstInputMode('')).toBe('numeric');expect(gstInputMode('27')).toBe('text');expect(gstInputMode('27AAPFU')).toBe('numeric');expect(gstInputMode('27AAPFU0939')).toBe('text');});
});
