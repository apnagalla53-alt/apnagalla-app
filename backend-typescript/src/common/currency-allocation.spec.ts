import {allocateCurrency} from './currency-allocation';
describe('Acquisition charge allocation',()=>{
 it('does not create a negative final charge on many tiny lines',()=>{const shares=allocateCurrency('.02',Array(8).fill('.01'));expect(shares.map(v=>v.toString())).toEqual(['0.01','0.01','0','0','0','0','0','0']);});
 it('allocates uneven charges by exact acquisition value',()=>{expect(allocateCurrency(15,[100,200]).map(v=>v.toString())).toEqual(['5','10']);});
});
