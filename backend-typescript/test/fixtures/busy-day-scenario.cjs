// Constructed equivalent workload: the report supplied totals, not original prices.
module.exports=async function busyDayScenario(post,date){
 const base=await require('./general-store-scenario.cjs')(post,date);
 const extra=await post('items',{name:'QA BUSY Baseline return',selling_price:90,opening_stock:1,opening_cost:60});
 const sale=await post('bills',{date,items:[{item_id:extra.id,quantity:1,rate:90}],payment_splits:[{method:'CASH',amount:90}]});
 await post('bills/return',{original_invoice_id:sale.id,refund_method:'CASH',lines:[{item_id:extra.id,quantity:1,rate:90}]});
 await post('items/'+base.biscuit.id,{selling_price:25});
 const specs=[['Rice 5kg Pack',399,'PKT'],['Oil Bottle',240,'LTR'],['Toor Dal 1kg Pack',180,'PKT'],['Tea Pack',140,'PKT'],['Sugar Pack',55,'PKT'],['Atta Pack',150,'PKT']];
 const items=[];
 for(const [name,price,unit] of specs)items.push(await post('items',{name:'QA BUSY - '+name,selling_price:price,purchase_price:price*0.7,unit_code:unit,selling_mode:'PIECE',opening_stock:50,opening_cost:price*0.7,barcode:'BUSY-'+items.length}));
 return {base,items,biscuit:{...base.biscuit,selling_price:25}};
};
