import {Prisma} from '@prisma/client';
import {postInventoryCost} from './costing';
const D=(v:any)=>new Prisma.Decimal(v);
function fixture(quantity=100,value=1000,unknown=0){
 const state:any={id:'pool',quantity:D(quantity),known_value:D(value),unknown_quantity:D(unknown)};
 const tx:any={inventoryCostState:{findUnique:vi.fn(async()=>state),update:vi.fn(async({data}:any)=>Object.assign(state,data))},stockMovement:{findMany:vi.fn()}};
 const line:any={item_id:'item',unit_id:'pcs',godown_id:'shop',quantity:10,source_line_id:'line'};
 const dto:any={company_id:'company',branch_id:'branch',movement_type:'SALES_OUT',source_document_id:'sale',lines:[line]};
 return {state,tx,line,dto};
}
describe('Authoritative inventory value decisions',()=>{
 it('normalizes acquisition units and adds value to the existing pool',async()=>{const f=fixture();f.dto.movement_type='PURCHASE_IN';f.line.cost_rate=120;const r=await postInventoryCost(f.tx,f.dto,f.line,D(100),D(10));expect(r.value_delta.toString()).toBe('1200');expect(f.state.quantity.toString()).toBe('200');expect(f.state.known_value.toString()).toBe('2200');});
 it('depletes current WAC for the sale, independent of master selling price',async()=>{const f=fixture(200,2200);const r=await postInventoryCost(f.tx,f.dto,f.line,D(10),D(1));expect(r.value_delta.toString()).toBe('-110');expect(f.state.known_value.toString()).toBe('2090');expect(r.cost_status).toBe('KNOWN');});
 it('preserves mixed-pool uncertainty and removes the known portion conservatively',async()=>{const f=fixture(20,120,10);const r=await postInventoryCost(f.tx,f.dto,f.line,D(2),D(1));expect(r.cost_status).toBe('UNKNOWN');expect(r.value_delta.toString()).toBe('-12');expect(f.state.unknown_quantity.toString()).toBe('9');});
 it('restores original sale COGS despite a different current average',async()=>{const f=fixture(290,4090);f.dto.movement_type='SALES_RETURN_IN';f.line.cost_origin_document_id='original';f.tx.stockMovement.findMany.mockResolvedValue([{base_quantity_delta:D(-10),value_delta:D(-110),unknown_quantity_delta:D(0),cost_status:'KNOWN'}]);const r=await postInventoryCost(f.tx,f.dto,f.line,D(4),D(1));expect(r.value_delta.toString()).toBe('44');expect(f.state.known_value.toString()).toBe('4134');});
 it('does not convert an unlinked return sales rate into acquisition cost',async()=>{const f=fixture();f.dto.movement_type='SALES_RETURN_IN';f.line.cost_rate=999;const r=await postInventoryCost(f.tx,f.dto,f.line,D(1),D(1));expect(r.cost_status).toBe('UNKNOWN');expect(r.value_delta.toString()).toBe('0');expect(f.state.unknown_quantity.toString()).toBe('1');});
 it('moves location value without changing the company pool',async()=>{const f=fixture();f.dto.movement_type='TRANSFER_OUT';await postInventoryCost(f.tx,f.dto,f.line,D(3),D(1));expect(f.tx.inventoryCostState.update).not.toHaveBeenCalled();expect(f.state.known_value.toString()).toBe('1000');});
 it('rejects negative stock before changing the value projection',async()=>{const f=fixture(1,10);await expect(postInventoryCost(f.tx,f.dto,f.line,D(2),D(1))).rejects.toThrow('Negative stock');expect(f.tx.inventoryCostState.update).not.toHaveBeenCalled();});
});
