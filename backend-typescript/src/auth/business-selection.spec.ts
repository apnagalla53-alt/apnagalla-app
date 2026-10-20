import { businessSelection } from './business-selection';
import { presetForBusiness } from './business-types';
describe('Business activities and primary precedence',()=>{
 it('keeps one primary and deduplicates additional activities',()=>{expect(businessSelection('FOOTWEAR',['CLOTHING','FOOTWEAR','CLOTHING'])).toEqual({business_type:'FOOTWEAR',additional_business_types:['CLOTHING']});});
 it('accepts legacy single selection and rejects unknown activity keys',()=>{expect(businessSelection('GROCERY').additional_business_types).toEqual([]);expect(()=>businessSelection('UNKNOWN')).toThrow();expect(()=>businessSelection('FOOTWEAR',['anything'])).toThrow();});
 it('adds garment suggestions while footwear stays primary',()=>{const p=presetForBusiness('FOOTWEAR',['CLOTHING']);expect(p.family).toBe('FOOTWEAR');expect(p.recommendedUnits[0]).toBe('PAIR');expect(p.recommendedCategories.some(c=>c.name==='Clothing'&&c.family==='CLOTHING')).toBe(true);expect(p.serviceCalculator).toBe(false);});
 it.each(['AUTOMOTIVE','AUTOMOBILE_REPAIR','Automobile Repair','AUTO_REPAIR','Auto / Two-Wheeler Repair'])('recognizes existing repair value %s without rewriting it',key=>{const p=presetForBusiness(key);expect(p.family).toBe('AUTOMOTIVE');expect(p.serviceCalculator).toBe(true);expect(p.serviceSuggestions).toContain('General Service');});
 it.each(['GROCERY','CLOTHING','FOOTWEAR','HARDWARE','AUTO_PARTS'])('does not leak service calculator into %s',key=>expect(presetForBusiness(key).serviceCalculator).toBe(false));
 it('keeps service suggestions contextual to explicit additional activity',()=>{expect(presetForBusiness('CLOTHING',['AUTOMOTIVE']).serviceCalculator).toBe(true);expect(presetForBusiness('AUTOMOTIVE',['AUTO_PARTS']).recommendedUnits[0]).toBe('PCS');});
});
