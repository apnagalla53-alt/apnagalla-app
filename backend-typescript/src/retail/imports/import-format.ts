import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import * as XLSX from 'xlsx';
import { unzipSync } from 'fflate';
import { createHash } from 'crypto';

export const MAX_ROWS = 10000;
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const key = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
export type SourceRow = Record<string, string>;
export function parseExport(buffer: Buffer, filename: string, kind: string, options: { sheet?: string; headerRow?: number; rejectFormulas?: boolean } = {}) {
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new BadRequestException('Choose a non-empty file up to 5 MB');
  const ext = filename.split('.').pop()?.toLowerCase();
  let rows: any[] = [], sheets: string[] = [];
  try {
    if (['xlsx','xls','xlsm','xlsb','ods'].includes(ext!)) {
      if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
        let total = 0, count = 0;
        unzipSync(buffer, {filter: entry => {
          total += entry.originalSize; count++;
          if (total > 50 * 1024 * 1024 || count > 1000) throw new Error('Workbook expands beyond the safe limit');
          return false;
        }});
      }
      const book = XLSX.read(buffer, {type:'buffer', cellDates:false, bookVBA:false, sheetRows:MAX_ROWS + (options.headerRow || 1) + 1});
      sheets = book.SheetNames;
      const name = options.sheet || sheets[0];
      if (!book.Sheets[name]) throw new Error('Choose a sheet listed in this workbook');
      if (options.rejectFormulas && Object.values(book.Sheets[name]).some((cell:any) => cell && typeof cell === 'object' && cell.f)) throw new Error('Replace spreadsheet formulas with plain values before uploading');
      rows = table(XLSX.utils.sheet_to_json<any[]>(book.Sheets[name], {header:1, raw:false, defval:''}), options.headerRow || 1);
    } else {
      const text = buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.subarray(2).toString('utf16le') : new TextDecoder('utf-8', {fatal:true}).decode(buffer).replace(/^\uFEFF/, '');
      if (ext === 'json' || ext === 'ndjson') {
        const data = ext === 'ndjson' ? text.trim().split(/\r?\n/).map(l=>JSON.parse(l)) : JSON.parse(text);
        rows = extract(data, kind);
      } else if (ext === 'xml') {
        if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML document types and entities are not allowed');
        if (XMLValidator.validate(text) !== true) throw new Error('XML is not well formed');
        rows = extract(new XMLParser({ignoreAttributes:false, parseTagValue:false, parseAttributeValue:false, processEntities:false}).parse(text), kind);
      } else if (['csv','tsv','txt'].includes(ext!)) {
        const delimiters = ext === 'tsv' ? ['\t'] : [',',';','\t','|'];
        let best: any[] = [];
        for (const delimiter of delimiters) {
          try {
            const data = parse(text, {delimiter, bom:true, skip_empty_lines:true, max_record_size:100000});
            if (data.length && (data[options.headerRow! - 1 || 0]?.length || 0) > (best[options.headerRow! - 1 || 0]?.length || 0)) best = data;
          } catch { /* Try the next explicit delimiter; no broken row is dropped. */ }
        }
        if (!best.length) throw new Error('CSV rows are inconsistent. Check separators and quoted cells');
        rows = table(best, options.headerRow || 1);
      } else throw new Error('Use CSV, TSV, TXT, XLS, XLSX, XLSM, XLSB, ODS, JSON, NDJSON or XML. PDF/images and proprietary backups need a structured export; they are not posted automatically');
    }
    if (!rows.length) throw new Error('No records found for this data type. Choose the correct sheet/header row or export masters');
    if (rows.length > MAX_ROWS) throw new Error('Split the export into files of at most 10,000 records');
    const clean: SourceRow[] = rows.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Record ${index+1} must have named columns`);
      const result: SourceRow = Object.create(null);
      if (Object.keys(row).length > 200) throw new Error('At most 200 columns are supported');
      for (const [name, value] of Object.entries(row)) {
        if (forbidden.has(name) || name.length > 255) throw new Error('Unsafe or overlong column name');
        if (value && typeof value === 'object') throw new Error(`Nested column ${name} needs a tabular export or a dedicated adapter`);
        const text = value == null ? '' : String(value);
        if (text.length > 4000) throw new Error(`Column ${name} exceeds 4,000 characters`);
        result[name] = text.trim();
      }
      return result;
    });
    return {rows:clean, headers:[...new Set(clean.flatMap(r=>Object.keys(r)))], sheets};
  } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Could not read this export'); }
}
function table(data: any[][], header: number) {
  if (!Number.isInteger(header) || header < 1 || header > 50 || !data[header-1]) throw new Error('Header row must be between 1 and 50');
  const headers = data[header-1].map(v=>String(v || '').trim());
  if (headers.some(h=>!h) || new Set(headers.map(key)).size !== headers.length) throw new Error('Every column needs a distinct, non-empty header');
  return data.slice(header).filter(r=>r.some(v=>v !== '' && v != null)).map(r=>{
    if (r.length > headers.length) throw new Error('A row has more values than headers');
    return Object.fromEntries(headers.map((h,i)=>[h,r[i] ?? '']));
  });
}
function extract(input: any, kind: string): any[] {
  const tag = kind === 'ITEMS' || kind === 'STOCK' ? 'STOCKITEM' : 'LEDGER';
  let found: any[] = [];
  const visit = (value:any, depth=0) => {
    if (depth > 15) throw new Error('Export nesting is too deep');
    if (!value || typeof value !== 'object') return;
    for (const [k,v] of Object.entries(value)) {
      if (k.toUpperCase() === tag) found.push(...(Array.isArray(v)?v:[v]));
      else if (typeof v === 'object') visit(v,depth+1);
    }
  };
  visit(input);
  if (found.length) return found.filter(r=>{
    if (tag !== 'LEDGER') return true;
    const parent = key(String(r.PARENT || r.parent || ''));
    return kind === 'CUSTOMERS' ? parent === 'sundrydebtors' : parent === 'sundrycreditors';
  }).map(r=>{
    // Tally nested metadata remains an explicit JSON column in the source audit.
    const row = Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v === 'object' ? JSON.stringify(v) : v]));
    for(const name of ['NAME','name','@_NAME'])if(name in row){row['Tally Source '+name]=row[name];delete row[name];}
    row['Name'] = r['@_NAME'] || r.NAME || r.name || '';
    if (r.OPENINGBALANCE !== undefined && tag === 'LEDGER') {
      const amount = String(r.OPENINGBALANCE).trim();
      row['Tally Source Opening Balance']=row.OPENINGBALANCE;delete row.OPENINGBALANCE;
      row['Opening Due'] = /^-?\d+(\.\d+)?$/.test(amount) ? String(kind === 'CUSTOMERS' ? -Number(amount) : Number(amount)) : amount;
    }
    return row;
  });
  if (Array.isArray(input)) return input.map(r=>r.record || r);
  for (const name of ['rows','data','items','customers','suppliers']) if (Array.isArray(input?.[name])) return input[name];
  throw new Error('Choose a JSON array of records, a rows/data array, or a supported Tally master export');
}
