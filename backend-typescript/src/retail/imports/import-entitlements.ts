import { SourceRow, key } from './import-format';

const unsupportedFields: [RegExp,string][] = [
  [/^(hasvariants|variant|variants|variantsku|size|colour|color|variantattributes)$/,'VARIANTS'],
  [/^(trackbatch|batch|batchno|batchnumber|batchid|expiry|expirydate|manufacturingdate)$/,'BATCH_TRACKING'],
  [/^(trackserial|serial|serialno|serialnumber|serialnumbers|warrantydays)$/,'SERIAL_TRACKING'],
  [/^(isbundle|bundle|bundlecomponents|kitcomponents)$/,'BUNDLES'],
  [/^(modifier|modifiers|modifieroptions)$/,'MODIFIERS'],
  [/^(unitconversion|conversionfactor|alternateunit|secondaryunit)$/,'MULTI_UNIT'],
  [/^(compatibility|compatibilitytags|modelmetadata)$/,'COMPATIBILITY'],
  [/^(pricelist|pricelistid|pricelevel)$/,'ADVANCED_PRICING'],
];

/** Detect paid source columns even when they are not mapped, instead of silently dropping them. */
export function importCapabilities(kind:string,source:SourceRow,fields:any) {
  const required=new Set<string>([kind==='CUSTOMERS'?'KHATA':kind==='SUPPLIERS'?'PURCHASING':'INVENTORY']);
  const unsupported:string[]=[];
  for(const [header,value] of Object.entries(source)) {
    if(value==null||String(value).trim()==='')continue;
    const normalized=key(header);
    if(/^(hasvariants|trackbatch|trackserial|isbundle)$/.test(normalized)&&/^(false|no|0)$/i.test(String(value).trim()))continue;
    const match=unsupportedFields.find(([pattern])=>pattern.test(normalized));
    if(match){required.add(match[1]);unsupported.push(header);}
  }
  if(['WEIGHT','VOLUME','LENGTH','AREA'].includes(fields.selling_mode))required.add(fields.selling_mode);
  if(fields.selling_mode==='SERVICE'||fields.item_type==='SERVICE')required.add('SERVICES');
  for(const [field,feature] of [['has_variants','VARIANTS'],['track_batch','BATCH_TRACKING'],['track_serial','SERIAL_TRACKING'],['is_bundle','BUNDLES']] as const)if(fields[field])required.add(feature);
  return {required:[...required],unsupported};
}
