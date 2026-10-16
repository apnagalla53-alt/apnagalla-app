import { describe,it,expect } from 'vitest';
import { shopInitials } from './bill-number';
import { validatePassword } from '../auth/password-policy';
describe('Shop bill series and ordinary password policy',()=>{
 it.each([['ezzy paints and sanitery','EPS'],['Ezzy Paints','EP'],['R.K. Traders','RKT'],['','BILL'],['and the','AT']])('derives a stable readable prefix for %s',(name,prefix)=>expect(shopInitials(name)).toBe(prefix));
 it.each(['12345678','abcdefgh','ABCDEFGH','1234abcd'])('allows an eight-character shop password without mixture rules',password=>expect(()=>validatePassword(password)).not.toThrow());
 it('retains bcrypt input limits',()=>{expect(()=>validatePassword('1234567')).toThrow();expect(()=>validatePassword('x'.repeat(73))).toThrow();expect(()=>validatePassword('🙂'.repeat(20))).toThrow();});
});
