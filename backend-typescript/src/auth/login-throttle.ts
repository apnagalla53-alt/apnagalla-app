import { consumeRate } from '../common/shared-rate-limit';
export const throttleLogin=(key:string)=>consumeRate(key,20,60000);
