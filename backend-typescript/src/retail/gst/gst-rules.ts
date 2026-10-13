import { BadRequestException } from '@nestjs/common';

// NIC's domestic GST state codes. Retired 25/28 are not offered for new documents.
export const GST_STATES:Record<string,string> = {
  '01':'Jammu and Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra and Nagar Haveli and Daman and Diu','27':'Maharashtra','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman and Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh',
};
export const GST_UQC = ['BAG','BAL','BDL','BKL','BOU','BOX','BTL','BUN','CAN','CBM','CCM','CMS','CTN','DOZ','DRM','GGK','GMS','GRS','GYD','KGS','KLR','KME','LTR','MTR','MLT','MTS','NOS','PAC','PCS','PRS','QTL','ROL','SET','SQF','SQM','SQY','TBS','TGM','THD','TON','TUB','UGS','UNT','YDS','OTH'];
export const localTaxName=(state:string)=>['04','26','31','35','38'].includes(state)?'UTGST':'SGST';
export const stateCode=(value:string|null|undefined)=>Object.keys(GST_STATES).find(code=>code===value||GST_STATES[code].toLowerCase()===value?.trim().toLowerCase())||'';
export function requireState(code:string) { if(!GST_STATES[code])throw new BadRequestException('Choose a supported Indian state / union territory'); }
export function gstChecksum(first14:string) {
  const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';let factor=2,total=0;
  for(let index=13;index>=0;index--){const value=alphabet.indexOf(first14[index]);if(value<0)throw new BadRequestException('Invalid GSTIN');const product=value*factor;total+=Math.floor(product/36)+product%36;factor=factor===2?1:2;}
  return alphabet[(36-total%36)%36];
}
export function requireGstin(gstin:string,code:string) {
  requireState(code);
  if(!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/.test(gstin)||gstin.slice(0,2)!==code||gstChecksum(gstin.slice(0,14))!==gstin[14])throw new BadRequestException('GSTIN format, checksum or state code is invalid. This does not verify GST registration with the government.');
}
export function defaultUqc(code:string) {
  const normalized=code.toUpperCase();return ({KG:'KGS',G:'GMS',GM:'GMS',SQFT:'SQF',ML:'MLT',L:'LTR',M:'MTR'} as Record<string,string>)[normalized]||(GST_UQC.includes(normalized)?normalized:'OTH');
}
