export function gstInputMode(value:string):'numeric'|'text'{const position=value.length;return position<2||position>=7&&position<11?'numeric':'text';}
export function gstInputError(gstin:string,state:string){
  if(gstin.length!==15)return `GSTIN needs 15 characters. You have entered ${gstin.length}.`;
  if(!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/.test(gstin))return 'Check the GSTIN on your registration certificate. Use uppercase letters and numbers.';
  if(gstin.slice(0,2)!==state)return `The GSTIN starts with ${gstin.slice(0,2)}. Choose the matching registered state or correct the GSTIN.`;
  const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';let factor=2,total=0;
  for(let i=13;i>=0;i--){const p=alphabet.indexOf(gstin[i])*factor;total+=Math.floor(p/36)+p%36;factor=factor===2?1:2;}
  return alphabet[(36-total%36)%36]!==gstin[14]?'The GSTIN check digit does not match. Please check all 15 characters.':'';
}
