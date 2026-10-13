import { parseExport } from './import-format';
import { suggestMapping } from './import-presets';
import { reportIntent } from '../reports/report-assistant.service';
import * as XLSX from 'xlsx';
describe('Migration source parsing and report intents',()=>{
  it('reads quoted comma, multiline and Hindi CSV without losing text',()=>{
    const r=parseExport(Buffer.from('Name,SKU,Note\r\n"आटा, नया",A1,"first\nsecond"'),'items.csv','ITEMS');
    expect(r.rows[0]).toEqual({Name:'आटा, नया',SKU:'A1',Note:'first\nsecond'});
  });
  it('reads UTF16LE Tally tabular exports',()=>{
    const r=parseExport(Buffer.concat([Buffer.from([255,254]),Buffer.from('Name\tSKU\r\nMilk\tM1','utf16le')]),'items.tsv','ITEMS');expect(r.rows[0].SKU).toBe('M1');
  });
  it.each(['xlsx','xls','ods'])('reads %s workbooks and exposes sheet choice',ext=>{
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Name','SKU'],['Milk','M1']]),'Items');
    const result=parseExport(XLSX.write(wb,{type:'buffer',bookType:ext as any}),'items.'+ext,'ITEMS');expect(result.rows[0].SKU).toBe('M1');expect(result.sheets).toContain('Items');
  });
  it('rejects duplicate headers',()=>expect(()=>parseExport(Buffer.from('Name,Name\nA,B'),'bad.csv','ITEMS')).toThrow());
  it('rejects prototype keys',()=>expect(()=>parseExport(Buffer.from('[{"name":"A","__proto__":"bad"}]'),'bad.json','ITEMS')).toThrow());
  it('rejects XML entity expansion',()=>expect(()=>parseExport(Buffer.from('<!DOCTYPE data [<!ENTITY x SYSTEM "file:///etc/passwd">]><data>&x;</data>'),'bad.xml','ITEMS')).toThrow());
  it('rejects unsupported proprietary backups',()=>expect(()=>parseExport(Buffer.from('backup'),'data.dat','ITEMS')).toThrow());
  it('retains formula-like source cells as text',()=>expect(parseExport(Buffer.from('Name,SKU\n=1+1,A1'),'safe.csv','ITEMS').rows[0].Name).toBe('=1+1'));
  it('preserves the natural sign of Tally opening receivables',()=>{
    const result=parseExport(Buffer.from('<ENVELOPE><LEDGER NAME="A"><NAME>A</NAME><PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>-200</OPENINGBALANCE></LEDGER></ENVELOPE>'),'tally.xml','CUSTOMERS');expect(result.rows[0]['Opening Due']).toBe('200');expect(suggestMapping('CUSTOMERS',result.headers)).toMatchObject({name:'Name',opening_balance:'Opening Due'});
  });
  it('does not silently turn Tally customer advances into dues',()=>{
    const result=parseExport(Buffer.from('<ENVELOPE><LEDGER NAME="A"><PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>200</OPENINGBALANCE></LEDGER></ENVELOPE>'),'tally.xml','CUSTOMERS');expect(result.rows[0]['Opening Due']).toBe('-200');
  });
  it('requires a person to resolve ambiguous columns',()=>expect(suggestMapping('ITEMS',['Name','Item Name','SKU']).name).toBeUndefined());
  it.each([['aaj kitne logo ko udhaar diya','UDHAR'],['आज कितने लोगों को उधार दिया','UDHAR'],['aaj konsa naya maal aaya','RECEIVED'],['आज बिक्री कितनी हुई','SALES'],['aaj kitna kharch hua','EXPENSES'],['daily galla','SUMMARY']])('understands %s',(query,intent)=>expect(reportIntent(query)).toBe(intent));
  it('rejects unsupported queries instead of inventing an answer',()=>expect(()=>reportIntent('delete all records')).toThrow());
});
