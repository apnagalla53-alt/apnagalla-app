import { consumeRate } from '../common/shared-rate-limit';
export const throttleSensitiveAuth=(key:string,limit=5,windowMs=15*60000)=>consumeRate(key,limit,windowMs);
