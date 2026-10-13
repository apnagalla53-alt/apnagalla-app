export type GstProfile = {
  legal_name:string; trade_name?:string; address:string; state_code:string; gstin:string;
  phone?:string; email?:string; invoice_prefix:string; hsn_digits:number;
  electronic_reporting:'NOT_REQUIRED'|'REQUIRED'|'UNSURE'; regular_registration:boolean;
  signatory:string; terms?:string;
};
export type GstRecipient = {name:string;address:string;state_code:string;gstin?:string;delivery_address:string;delivery_state_code:string};
export type GstLineInput = {line_id:string;description:string;hsn:string;uqc:string;quantity:string;unit:string;taxable:string;tax:string;tax_rate:number|null};
export type GstDraft = {bill:{id:string;number:string;date:string;status:string;total:string;tax:string};profile:GstProfile|null;states:Record<string,string>;uqc:string[];recipient:GstRecipient;place_of_supply:string;reverse_charge:boolean;lines:GstLineInput[]};
export type GstSnapshot = {
  supply_kind?:'SERVICES'|'GOODS';
  document_number:string|null;issue_date:string;financial_year:string;
  source_bill:{id:string;number:string;date:string};supplier:GstProfile&{state:string};
  recipient:GstRecipient&{state:string;delivery_state:string};place_of_supply:{code:string;name:string};
  interstate:boolean;local_tax_name:string;reverse_charge:boolean;
  lines:{number:number;description:string;hsn:string;quantity:string;unit:string;uqc:string;net_rate:string;discount:string;taxable:string;rate:string;cgst_rate:string;local_rate:string;igst_rate:string;cgst:string;local:string;igst:string;tax:string;total:string;dimensions?:Record<string,number>;variant?:Record<string,string>;serials:string[]}[];
  summary:{hsn:string;rate:string;taxable:string;cgst:string;local:string;igst:string}[];
  totals:{taxable:string;cgst:string;local:string;igst:string;tax:string;round_off:string;grand_total:string;paid_at_issue:string;balance_at_issue:string};
};
export type GstDocument = {id:string;document_number:string;snapshot:GstSnapshot;created_at:string};
