// Synthetic report scenario. Every stock/accounting mutation uses the Retail HTTP facade.
module.exports=async function generalStoreScenario(post,date){
 const createItem=(name,rate,cost,unit='PCS',minimum=0,batch=false)=>post('items',{name:'QA 1L '+name,selling_price:rate,purchase_price:cost,unit_code:unit,low_stock_threshold:minimum,track_batch:batch,selling_mode:unit==='KG'?'WEIGHT':'PIECE'});
 const biscuit=await createItem('Biscuit',10,7),soap=await createItem('Soap',35,28,'PCS',5),looseRice=await createItem('Loose rice',60,45,'KG');
 const oldSupplier=await post('suppliers',{name:'QA DEMO supplier'}),supplier=await post('suppliers',{name:'QA 1L supplier'});
 const oldCustomer=await post('customers',{name:'QA DEMO customer',credit_allowed:true}),customer=await post('customers',{name:'QA 1L Neha',credit_allowed:true});
 const line=(item,quantity,rate)=>({item_id:item.id,quantity,rate});
 const buy=(item,quantity,purchase_rate,extra={})=>({item_id:item.id,quantity,purchase_rate,...extra});
 const bill=(items,amount,method='CASH',extra={})=>post('bills',{date,items,payment_splits:method==='UDHAR'?[]:[{method,amount}],...extra});
 const payment=(kind,party,amount,method='CASH')=>post(kind+'/'+party.id+'/payments',{amount,payment_method:method,date});
 await post('purchases',{supplier_id:oldSupplier.id,purchase_date:date,payment_status:'CREDIT',lines:[buy(biscuit,20,7),buy(soap,12,28),buy(looseRice,10,45)]});
 await post('purchases',{supplier_id:oldSupplier.id,purchase_date:date,payment_status:'CREDIT',total_amount:250});
 await payment('suppliers',oldSupplier,400);
 const oldCredit=await bill([line(biscuit,2,10),line(looseRice,1,60),line(soap,1,35)],115,'UDHAR',{customer_id:oldCustomer.id});
 await payment('customers',oldCustomer,50);await payment('customers',oldCustomer,65);
 const quick=await post('bills/amount-sale',{amount:120,payment_method:'CASH',date});
 await bill([line(biscuit,1,10),line(soap,6,35)],200,'CASH',{bill_discount:20});
 await bill([line(biscuit,1,10)],10);
 await post('bills/return',{original_invoice_id:oldCredit.id,refund_method:'CASH',lines:[line(biscuit,1,10)]});
 const expense=(amount)=>post('expenses',{type:'BUSINESS_EXPENSE',category_id:rent.id,amount,payment_method:'CASH',date});
 // Categories are initialized by tenant provisioning; lookup is supplied by the adapter.
 const rent=await post('$rent',{});
 await expense(100);await post('expenses',{type:'OWNER_WITHDRAWAL',amount:50,payment_method:'CASH',date});
 const rice=await createItem('Rice 5kg bag',360,295,'PKT',10,true),tea=await createItem('Tea 250g',140,115,'PKT',6,true),flour=await createItem('Flour 5kg',280,225,'PKT',10),sugar=await createItem('Sugar loose',55,44,'KG',20),dal=await createItem('Toor dal',150,126,'KG',5),oil=await createItem('Sunflower oil',160,137,'LTR',12),detergent=await createItem('Detergent 1kg',120,95,'PKT'),water=await createItem('Mineral water',20,12,'BOTTLE');
 const expiry=new Date(date+'T00:00:00Z');expiry.setUTCFullYear(expiry.getUTCFullYear()+1);
 const purchase=await post('purchases',{supplier_id:supplier.id,purchase_date:date,payment_status:'CREDIT',lines:[
  buy(rice,30,295,{batch_number:'QA-1L-RICE',expiry_date:expiry.toISOString().slice(0,10)}),buy(tea,50,115,{batch_number:'QA-1L-TEA',expiry_date:expiry.toISOString().slice(0,10)}),
  buy(flour,60,225),buy(sugar,50,44),buy(dal,50,126),buy(oil,100,137),buy(detergent,60,95),buy(water,100,12),buy(soap,506,28),buy(biscuit,1000,7),buy(looseRice,18,45)
 ]});
 await payment('suppliers',supplier,30000);await payment('suppliers',supplier,20000,'UPI');
 const credit=await bill([line(soap,200,35),line(water,100,20),line(detergent,60,120)],16200,'UDHAR',{customer_id:customer.id});
 await payment('customers',customer,5000);
 const cash=await bill([line(sugar,50,55),line(rice,30,360),line(flour,60,280)],30350);
 const upi=await bill([line(dal,50,150),line(tea,50,140),line(oil,100,160)],30500,'UPI');
 await bill([line(biscuit,1000,10),line(looseRice,27,60),line(soap,311,35)],22505);
 const returned=await post('bills/return',{original_invoice_id:cash.id,refund_method:'CASH',lines:[line(rice,1,360)]});
 await expense(4000);await post('expenses',{type:'OWNER_WITHDRAWAL',amount:2000,payment_method:'CASH',date});
 await post('galla/count',{date,opening_cash:500,actual_cash:21880});
 return {biscuit,soap,looseRice,rice,tea,flour,sugar,dal,oil,detergent,water,supplier,oldSupplier,customer,oldCustomer,cash,upi,credit,quick,returned,purchase};
};
