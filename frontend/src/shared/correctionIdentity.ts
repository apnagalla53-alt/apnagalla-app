export type CorrectionIdentity={name:string;reason:string};
export class CorrectionCancelled extends Error { readonly code='USER_CANCELLED';constructor(){super('Change cancelled.');} }
export function requestCorrectionIdentity():Promise<CorrectionIdentity>{return new Promise((resolve,reject)=>window.dispatchEvent(new CustomEvent('apna-galla-correction',{detail:{resolve,reject}})));}
