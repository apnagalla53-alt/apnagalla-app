import { describe,it,expect } from 'vitest';
import { emptyFootwearOptions,footwearCombinations,variantOptionKey } from '../../src/retail/components/footwearOptionsModel';
describe('Footwear option combinations',()=>{
 it('does not configure variants until explicitly requested',()=>expect(footwearCombinations(emptyFootwearOptions)).toEqual([]));
 it('uses the merchant size system and combines chosen colours',()=>expect(footwearCombinations({...emptyFootwearOptions,hasSizes:true,hasColours:true,sizes:['UK 8','Kids 3'],colours:['Black','White']})).toEqual([{Size:'UK 8',Colour:'Black'},{Size:'UK 8',Colour:'White'},{Size:'Kids 3',Colour:'Black'},{Size:'Kids 3',Colour:'White'}]));
 it('supports colour-only stock without inventing a size',()=>expect(footwearCombinations({...emptyFootwearOptions,hasColours:true,colours:['Brown']})).toEqual([{Colour:'Brown'}]));
 it('uses stable keys for optional variant-specific prices',()=>expect(variantOptionKey({Size:'8',Colour:'Black'})).toBe(variantOptionKey({Colour:'Black',Size:'8'})));
});
