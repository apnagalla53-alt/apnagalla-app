import { expect, test, vi } from 'vitest';
import { createUuid, sha256Hex } from '../../src/shared/browserCrypto';
test.each(['','abc','Apna Galla ₹१२३'])('native and LAN fallback produce identical SHA-256 for %s',async value=>{
 const native=await sha256Hex(value);const crypto=globalThis.crypto;
 try{vi.stubGlobal('crypto',{getRandomValues:crypto.getRandomValues.bind(crypto)});expect(await sha256Hex(value)).toBe(native);}finally{vi.unstubAllGlobals();}
 if(value==='abc')expect(native).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('LAN UUID fallback uses secure random values with RFC version and variant bits',()=>{
 const crypto=globalThis.crypto;try{vi.stubGlobal('crypto',{getRandomValues:crypto.getRandomValues.bind(crypto)});const ids=Array.from({length:50},()=>createUuid());expect(new Set(ids).size).toBe(50);for(const id of ids)expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);}finally{vi.unstubAllGlobals();}
});
