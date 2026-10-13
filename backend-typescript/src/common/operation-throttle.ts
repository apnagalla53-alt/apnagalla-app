import { consumeRate } from './shared-rate-limit';
export const throttleOperation=(key:string,limit:number)=>consumeRate(key,limit,60000);
