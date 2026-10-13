import { Test } from '@nestjs/testing';
import { INestApplication,RequestMethod,ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { INTENTS } from '../src/assistant/intent-library';
import { AssistantCatalogService } from '../src/assistant/assistant-catalog.service';
import { businessDate } from '../src/common/business-date';

describe('Assistant V1: real PostgreSQL and authenticated HTTP',()=>{
  let app:INestApplication,db:PrismaService,A:any,B:any,token:string,other:string,staffToken:string,platformToken:string,actor:string;
  let customer:any,supplier:any,item:any,category:any,bill:any;
  const suffix=Date.now().toString(36),password='DisposableAssistant!827',date=businessDate();
  const shift=(value:string,days:number)=>new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10),monthStart=date.slice(0,8)+'01';
  const [monthYear,monthNumber]=monthStart.split('-').map(Number),previousMonth=new Date(Date.UTC(monthYear,monthNumber-2,1)).toISOString().slice(0,10);
  const http=(method:string,path:string,shop=A,t=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/'+path).set('Authorization','Bearer '+t).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
  const retail=(method:string,path:string,body?:any,shop=A,t=token)=>{const r=http(method,'retail/'+path,shop,t);return body===undefined?r:r.send(body);};
  const ask=async(message:string,options:any={},shop=A,t=token)=>(await http('post','assistant/query',shop,t).send({message,language:'en',...options}).expect(201)).body;
  const platform=(method:string,path:string)=>(request(app.getHttpServer()) as any)[method]('/api/v1/platform/assistant/'+path).set('Authorization','Bearer '+platformToken);
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    for(const [name,set] of [['assistant-a-',(s:any)=>A=s],['assistant-b-',(s:any)=>B=s]] as const){set(await app.get(TenantProvisioningService).provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id,organizationName:name+suffix,adminEmail:name+suffix+'@test.invalid',adminName:'Rahul',adminPassword:password}));}
    for(const shop of [A,B])for(const code of new Set([...INTENTS.map(i=>i.feature),'VARIANTS','MULTI_UNIT'])){const feature=await db.feature.findUniqueOrThrow({where:{code}});await db.tenantEntitlement.upsert({where:{uix_tenant_entitlements:{organization_id:shop.organization.id,feature_id:feature.id}},create:{organization_id:shop.organization.id,feature_id:feature.id,is_enabled:true},update:{is_enabled:true}});}
    token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;other=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password}).expect(200)).body.access_token;
    await db.godown.update({where:{id:A.godown.id},data:{name:'Main'}});
    customer=(await retail('post','customers',{name:'Ramesh',credit_allowed:true}).expect(201)).body;
    supplier=(await retail('post','suppliers',{name:'Mohan',credit_allowed:true}).expect(201)).body;
    const raj=(await retail('post','suppliers',{name:'Raj Traders'}).expect(201)).body;
    item=(await retail('post','items',{name:'Maggi',selling_price:20,purchase_price:10,low_stock_threshold:20}).expect(201)).body;
    await retail('post','purchases',{supplier_id:supplier.id,lines:[{item_id:item.id,quantity:10,purchase_rate:10}],payment_status:'CREDIT',purchase_date:date}).expect(201);
    await retail('post','purchases',{supplier_id:raj.id,lines:[{item_id:item.id,quantity:1,purchase_rate:10}],payment_status:'CREDIT',purchase_date:date}).expect(201);
    for(const [payment_method,amount] of [['CASH',100],['UPI',80],['CARD',30],['BANK',20],['UDHAR',200]])await retail('post','bills/amount-sale',{amount,payment_method,customer_id:customer.id,date}).expect(201);
    for(const d of [1,3,5])await retail('post','bills/amount-sale',{amount:700,payment_method:'CASH',customer_id:customer.id,date:shift(previousMonth,d)}).expect(201);
    for(const d of [1,3,5])await retail('post','bills/amount-sale',{amount:100,payment_method:'CASH',customer_id:customer.id,date:shift(monthStart,d)}).expect(201);
    bill=(await retail('post','bills',{items:[{item_id:item.id,quantity:2,rate:20}],payment_splits:[{method:'CASH',amount:40}],customer_id:customer.id,date}).expect(201)).body;
    const detail=(await retail('get','bills/'+bill.id).expect(200)).body;
    await retail('post','bills/return',{original_invoice_id:bill.id,refund_method:'CASH',lines:[{item_id:item.id,original_line_id:detail.sales_invoice_line[0].id,quantity:1,rate:20}]}).expect(201);
    await retail('post','customers/'+customer.id+'/payments',{amount:50,payment_method:'CASH',date}).expect(201);
    await retail('post','suppliers/'+supplier.id+'/payments',{amount:15,payment_method:'CASH',date}).expect(201);
    category=(await retail('post','expense-categories',{name:'Petrol'}).expect(201)).body;
    await retail('post','expenses',{type:'BUSINESS_EXPENSE',category_id:category.id,amount:10,payment_method:'CASH',date}).expect(201);
    await retail('post','expenses',{type:'OWNER_WITHDRAWAL',amount:5,payment_method:'CASH',date}).expect(201);
    await retail('post','galla/count',{date,opening_cash:200}).expect(201);
    for(let i=0;i<7;i++)await retail('post','needs',{name:'Need '+i,priority:i===0?'URGENT':'NORMAL'}).expect(201);
    await retail('post','customers',{name:'Ramesh',credit_allowed:true},B,other).expect(201);
    await retail('post','suppliers',{name:'Raj Traders'},B,other).expect(201);
    await retail('post','items',{name:'Maggi',selling_price:30,purchase_price:5,opening_stock:99},B,other).expect(201);
    await retail('post','bills/amount-sale',{amount:999,payment_method:'CASH',date},B,other).expect(201);
    const permission=await db.permission.upsert({where:{code:'sales.read'},create:{code:'sales.read',module:'sales',resource:'sales',action:'read'},update:{}});
    const role=await db.role.create({data:{organization_id:A.organization.id,name:'ASSISTANT_CASHIER_'+suffix,role_permissions:{create:{permission_id:permission.id}}}});
    const staff=await db.user.create({data:{organization_id:A.organization.id,username:'assistant-staff-'+suffix+'@test.invalid',display_name:'Limited Cashier',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id,company_id:A.company.id,branch_id:A.branch.id}}}});
    staffToken=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:staff.username,password}).expect(200)).body.access_token;
    const prole=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN',system_role:true},update:{}});
    const admin=await db.platformUser.create({data:{username:'assistant-platform-'+suffix,display_name:'Assistant Audit',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:prole.id}}}});actor=admin.id;
    platformToken=(await request(app.getHttpServer()).post('/api/v1/platform/auth/login').send({username:admin.username,password}).expect(200)).body.access_token;
  },120000);
  afterAll(async()=>{if(db){await db.assistantIntentConfig.updateMany({data:{active:true}});await db.assistantExample.deleteMany({where:{source:{in:['ADMIN_ADDED','UNKNOWN_MAPPED']},phrase:{startsWith:'audit-'+suffix}}});}if(app)await app.close();});
  const queries:Record<string,string>={ITEM_PROFIT:'Maggi profit',BILL_PROFIT:'placeholder',PURCHASE_SUMMARY:'aaj kitna maal kharida',CUSTOMER_SALES:'customer Ramesh sale',STAFF_SALES:'Rahul ne kitni sale ki',ITEM_SALES:'Maggi kitni biki',BILL_LOOKUP:'placeholder',CUSTOMER_KHATA:'customer Ramesh ledger',CUSTOMER_BALANCE:'customer Ramesh balance',CUSTOMER_PAYMENT_RECEIVED:'payments from customer Ramesh',SUPPLIER_BALANCE:'supplier Mohan balance',SUPPLIER_KHATA:'Mohan supplier ka khata',SUPPLIER_PURCHASE_SUMMARY:'Raj Traders se kitni purchase hui',ITEM_STOCK:'Maggi stock',BATCH_STOCK:'Maggi batch stock',LOCATION_STOCK:'Main godown stock'};
  // Independent expectations from the posted fixture, including the return and later collections.
  const expectedSummaries:Record<string,Record<string,number>>={
    SALES_SUMMARY:{gross_sales:470,returns:20,net_sales:450,bills_count:6},CUSTOMER_SALES:{net_sales:450,bills_count:6},STAFF_SALES:{net_sales:450,bills_count:6},
    CASH_SALES:{cash_sales:140},UPI_SALES:{upi_sales:80},CARD_SALES:{card_sales:30},BANK_SALES:{bank_sales:20},UDHAR_SALES:{udhar_sales:200,udhar_bill_count:1,udhar_customers_count:1},BILL_COUNT:{bill_count:6},UDHAR_BILL_COUNT:{udhar_bill_count:1},
    BILL_LOOKUP:{total:40,due:0},DAILY_GALLA:{total_sales:470,opening_cash:200,expected_cash:340},EXPECTED_CASH:{expected_cash:340},OPENING_CASH:{opening_cash:200},CASH_RECEIVED:{cash_received:190},UPI_RECEIVED:{upi_received:80},CUSTOMER_DUE_RECEIVED:{payments:50},
    CUSTOMER_BALANCE:{balance:150},CUSTOMER_KHATA:{balance:150},CUSTOMER_TOTAL_DUE:{total_due:150,parties_count:1},CUSTOMER_PAYMENT_RECEIVED:{payments:50},CUSTOMER_OVERDUE:{overdue_amount:0,bills_count:0},
    SUPPLIER_BALANCE:{balance:85},SUPPLIER_KHATA:{balance:85},SUPPLIER_TOTAL_DUE:{total_due:95,parties_count:2},SUPPLIER_PAYMENT_SUMMARY:{payments:15},SUPPLIER_PURCHASE_SUMMARY:{total_purchases:10,purchase_count:1},
    ITEM_STOCK:{quantity:10},LOW_STOCK:{total_items:1,low_stock_count:1,out_of_stock_count:0},OUT_OF_STOCK:{out_of_stock_count:0},STOCK_SUMMARY:{total_items:1,low_stock_count:1,out_of_stock_count:0},LOCATION_STOCK:{total_items:1},EXPIRING_ITEMS:{stock_lots:0},EXPIRED_ITEMS:{stock_lots:0},BATCH_STOCK:{stock_lots:0},
    PURCHASE_SUMMARY:{total_purchases:110,purchase_count:2},NEW_STOCK_RECEIVED:{stock_movements:2},EXPENSE_SUMMARY:{business_expenses:10},EXPENSE_BY_CATEGORY:{business_expenses:10},OWNER_WITHDRAWAL_SUMMARY:{owner_withdrawal:5},NEED_LIST:{pending_needs:7},URGENT_NEEDS:{pending_needs:1},PENDING_NEEDS:{pending_needs:7},RETURN_SUMMARY:{total_returns:20,returns_count:1},RETURN_COUNT:{returns_count:1},
  };
  it.each(INTENTS.map(i=>[i.code,queries[i.code]||i.examples[0]]))('executes registered %s using real services',async(code,q)=>{
    const r=await ask(code==='BILL_LOOKUP'?'bill '+bill.document_number:code==='BILL_PROFIT'?'bill '+bill.document_number+' profit':q);expect(r.status,JSON.stringify({code,q,status:r.status,text:r.text})).toBe('SUCCESS');expect(r.routing.intent).toBe(code);expect(r.result).toBeDefined();expect(r.generated_at).toBeTruthy();expect(r.timings.tool_execution_ms).toBeGreaterThanOrEqual(0);
    if(INTENTS.find(i=>i.code===code)?.category==='financial'){expect(r.result.summary.gross_profit).toBe('10');expect(r.result.summary.cogs).toBe('10');expect(r.result.summary.cost_coverage).toBe('100');if(!['ITEM_PROFIT','BILL_PROFIT'].includes(code))expect(r.result.summary.net_business_profit).toBe('0');}
    else if(INTENTS.find(i=>i.code===code)?.category==='insight'){expect(r.result.insight,code).toBeDefined();expect(r.result.insight.current_period.from).toBeTruthy();expect(r.result.insight.comparison_period.from).toBeTruthy();expect(r.result.definition).toContain('No external LLM');}
    else if(expectedSummaries[code])expect(r.result.summary,code).toMatchObject(expectedSummaries[code]);
    else if(['TOP_SELLING_ITEMS','ITEM_SALES'].includes(code))expect(r.result.rows,code).toEqual(expect.arrayContaining([expect.objectContaining({item:'Maggi',quantity:1,value:20})]));
    else if(['SUBSCRIPTION_STATUS','SUBSCRIPTION_EXPIRY','CURRENT_PLAN'].includes(code)){
      const persisted=await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:A.organization.id},include:{organization:{include:{plan:true}}}});
      expect(r.result.summary,code).toMatchObject({status:persisted.organization.status==='TRIAL'?'TRIAL':persisted.status,plan:persisted.organization.plan?.name||'No plan',expires:persisted.expires_at.toISOString().slice(0,10)});
    }else throw new Error('Missing independent result expectation for '+code);
    expect(r.text.length).toBeGreaterThan(0);
    if(code==='NEW_STOCK_RECEIVED'){expect(r.result.rows).toEqual(expect.arrayContaining([expect.objectContaining({item:'Maggi',quantity:10}),expect.objectContaining({item:'Maggi',quantity:1})]));expect(r.result.summary).not.toHaveProperty('purchase_cost');expect(r.result.rows.every((row:any)=>!('cost' in row))).toBe(true);}
  });
  it('sales and Galla exactly match the UI report, including returns and physical cash',async()=>{
    const sales=(await retail('get',`reports/sales?from=${date}&to=${date}`).expect(200)).body;
    const r=await ask('aaj ki sale');expect(r.result.summary.net_sales).toBe(sales.summary.net_sales);expect(r.result.summary.net_sales).toBe(450);
    const g=(await retail('get','galla?date='+date).expect(200)).body;const a=await ask('aaj ka galla');for(const [k,v] of Object.entries(a.result.summary))expect(v).toBe(g[k]);expect(g.opening_cash).toBe(200);expect(g.upi_sales).toBe(80);expect(g.udhar_sales).toBe(200);expect(g.expected_cash).toBe(340);
  });
  it('month-to-date sales diagnosis compares the same dates last month and decomposes sales without double counting',async()=>{
    const r=await ask('Is month vs last month sale compare karo');expect(r.status).toBe('SUCCESS');expect(r.routing.intent).toBe('COMPARE_SALES');expect(r.result.insight.current_period).toEqual({from:monthStart,to:date});
    expect(r.result.insight.comparison_period).toEqual({from:previousMonth,to:shift(previousMonth,Math.min(Number(date.slice(8,10)),new Date(Date.UTC(Number(previousMonth.slice(0,4)),Number(previousMonth.slice(5,7)),0)).getUTCDate())-1)});
    expect(r.result.summary.current_sales).toBeLessThan(r.result.summary.previous_sales);expect(r.result.insight.confidence).toBe('HIGH');
    const drivers=r.result.insight.drivers.filter((d:any)=>d.evidence_type==='DIRECT'&&['BILL_COUNT','AVERAGE_BILL'].includes(d.type));expect(drivers.length).toBeGreaterThan(0);
    expect(drivers.reduce((s:number,d:any)=>s+Number(d.impact_amount),0)).toBeCloseTo(Number(r.result.summary.current_sales)-Number(r.result.summary.previous_sales),0);
    expect(r.result.insight.drivers.every((d:any)=>['DIRECT','CORRELATED','ESTIMATED'].includes(d.evidence_type))).toBe(true);
  });
  it('profit diagnosis matches Phase 5.6 reports and keeps cash signals separate from profit',async()=>{
    const report=(await retail('get',`reports/financial/summary?from=${date}&to=${date}`).expect(200)).body;
    const diagnosis=await ask('profit kam kyu hua');expect(diagnosis.status).toBe('SUCCESS');expect(diagnosis.routing.intent).toBe('WHY_PROFIT_DOWN');
    expect(Number(diagnosis.result.summary.current_gross_profit)).toBe(Number(report.gross_profit));expect(Number(diagnosis.result.summary.current_cogs)).toBe(Number(report.cogs));expect(Number(diagnosis.result.summary.current_value)).toBe(Number(report.net_business_profit));
    expect(diagnosis.result.insight.drivers.find((d:any)=>d.type==='GROSS_PROFIT_CHANGE').impact_amount).toBeCloseTo(Number(diagnosis.result.summary.current_gross_profit)-Number(diagnosis.result.summary.previous_gross_profit),0);
    expect(diagnosis.result.insight.drivers.find((d:any)=>d.type==='EXPENSE_CHANGE').impact_amount).toBeCloseTo(-(Number(diagnosis.result.summary.current_business_expenses)-Number(diagnosis.result.summary.previous_business_expenses)),0);
    const vs=await ask('sale badhi lekin profit kyu gira');expect(vs.routing.intent).toBe('SALES_VS_PROFIT_EXPLANATION');expect(vs.result.summary.metric).toBe('net_business_profit');
    const margin=await ask('margin kyu gira');expect(margin.routing.intent).toBe('MARGIN_CHANGE_EXPLANATION');expect(margin.result.insight.confidence).toBe('LIMITED');expect(margin.result.summary.previous_value).toBeNull();expect(margin.text).toContain('Margin comparison available nahi hai');
    const cash=await ask('profit hai fir cash kyu nahi hai');expect(cash.routing.intent).toBe('PROFIT_VS_CASH_EXPLANATION');expect(cash.result.insight.metric).toBe('net_business_profit');
    expect(cash.result.insight.drivers.map((d:any)=>d.type)).toEqual(expect.arrayContaining(['RECEIVABLE_MOVEMENT','INVENTORY_PURCHASES','SUPPLIER_PAYABLE_MOVEMENT']));
  });
  it('low-data comparison stays explicitly insufficient and cannot leak another tenant financials',async()=>{
    const b=await ask('Is month vs last month sale compare karo',{},B,other);expect(b.status).toBe('SUCCESS');expect(b.result.insight.confidence).toBe('INSUFFICIENT');expect(b.result.insight.drivers).toHaveLength(0);expect(b.result.summary.current_sales).toBe(999);expect(b.result.summary.previous_sales).toBe(0);expect(b.result.summary.change_percent,JSON.stringify({intent:b.routing.intent,summary:b.result.summary,insight:b.result.insight})).toBeNull();
    const a=await ask('Is month vs last month sale compare karo');expect(a.result.summary.current_sales).toBe(750);expect(a.result.summary.current_sales).not.toBe(b.result.summary.current_sales);
  });
  it('week-to-date questions compare the same weekdays in the previous week',async()=>{
    const r=await ask('this week vs last week sales compare');expect(r.status).toBe('SUCCESS');expect(r.result.insight.current_period.from).toBe(shift(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7)));
    expect(r.result.insight.comparison_period.from).toBe(shift(r.result.insight.current_period.from,-7));expect(r.result.insight.comparison_period.to).toBe(shift(r.result.insight.current_period.to,-7));
  });
  it('explains real sales growth while authoritative net profit falls after an expense increase',async()=>{
    const C=await app.get(TenantProvisioningService).provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id,organizationName:'assistant-v15-growth-'+suffix,adminEmail:'assistant-v15-growth-'+suffix+'@test.invalid',adminName:'Growth Owner',adminPassword:password});
    for(const code of new Set(INTENTS.map(i=>i.feature))){const feature=await db.feature.findUniqueOrThrow({where:{code}});await db.tenantEntitlement.upsert({where:{uix_tenant_entitlements:{organization_id:C.organization.id,feature_id:feature.id}},create:{organization_id:C.organization.id,feature_id:feature.id,is_enabled:true},update:{is_enabled:true}});}
    const ct=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:C.user.username,password}).expect(200)).body.access_token;
    const create=(path:string,body:any)=>(request(app.getHttpServer()).post('/api/v1/retail/'+path).set('Authorization','Bearer '+ct).set('X-Company-Id',C.company.id).set('X-Branch-Id',C.branch.id).set('X-Financial-Year-Id',C.financialYear.id).send(body));
    const vendor=(await create('suppliers',{name:'Growth Supplier'}).expect(201)).body;
    const product=(await create('items',{name:'Growth Flour',selling_price:700,purchase_price:500}).expect(201)).body;
    const expenseCategory=(await create('expense-categories',{name:'Growth Costs'}).expect(201)).body;
    await create('purchases',{supplier_id:vendor.id,lines:[{item_id:product.id,quantity:100,purchase_rate:500}],payment_status:'CREDIT',purchase_date:shift(previousMonth,-4)}).expect(201);
    for(const d of [1,3,5])await create('bills',{items:[{item_id:product.id,quantity:1,rate:600}],payment_splits:[{method:'CASH',amount:600}],date:shift(previousMonth,d-1)}).expect(201);
    for(const d of [1,3,5])await create('bills',{items:[{item_id:product.id,quantity:1,rate:700}],payment_splits:[{method:'CASH',amount:700}],date:shift(monthStart,d-1)}).expect(201);
    await create('expenses',{type:'BUSINESS_EXPENSE',category_id:expenseCategory.id,amount:1000,payment_method:'CASH',date:shift(monthStart,5)}).expect(201);
    const result=await ask('Is month sale badhi lekin profit kyu gira',{},C,ct);
    expect(result.status).toBe('SUCCESS');expect(result.routing.intent).toBe('SALES_VS_PROFIT_EXPLANATION');
    expect(Number(result.result.summary.current_sales)).toBeGreaterThan(Number(result.result.summary.previous_sales));
    expect(Number(result.result.summary.current_value)).toBeLessThan(Number(result.result.summary.previous_value));
    expect(Number(result.result.summary.current_gross_profit)).toBeGreaterThan(Number(result.result.summary.previous_gross_profit));
    expect(result.result.insight.drivers.find((d:any)=>d.type==='EXPENSE_CHANGE').impact_amount).toBeLessThan(0);
  });
  it('ordinary customer/supplier payments are real and checkout is excluded',async()=>{
    expect((await ask('aaj purana udhar kitna receive hua')).result.summary.payments).toBe(50);expect((await ask('supplier payments today')).result.summary.payments).toBe(15);
    expect((await ask('customer Ramesh balance')).result.summary.balance).toBe(150);expect((await ask('supplier Mohan balance')).result.summary.balance).toBe(85);
  });
  it('credit amount, bill count and distinct customer count answer the people question',async()=>{const r=await ask('aaj kitne logo ko udhaar diya');expect(r.status).toBe('SUCCESS');expect(r.result.summary).toEqual({udhar_sales:200,udhar_bill_count:1,udhar_customers_count:1});});
  it('stock matches Inventory after purchase, sale and return',async()=>{expect((await ask('Maggi stock')).result.summary.quantity).toBe(10);expect((await ask('is 5 Maggi available')).result.summary.available).toBe('Yes');expect((await ask('is 20 Maggi available')).result.summary.available).toBe('No');});
  it('does not return another tenant same-name stock or sales',async()=>{expect((await ask('Maggi stock',{},B,other)).result.summary.quantity).toBe(99);expect((await ask('aaj ki sale',{},B,other)).result.summary.net_sales).toBe(999);expect((await ask('aaj ki sale')).result.summary.net_sales).toBe(450);});
  it('native Hindi names resolve conservatively against the same real records',async()=>{for(const [q,intent] of [['रमेश से कितना लेना है','CUSTOMER_BALANCE'],['मोहन सप्लायर को कितना देना है','SUPPLIER_BALANCE'],['मैगी कितनी स्टॉक में है','ITEM_STOCK'],['राहुल कर्मचारी ने कितनी बिक्री की','STAFF_SALES'],['पेट्रोल का खर्च','EXPENSE_BY_CATEGORY']]){const r=await ask(q,{language:'hi'});expect(r.status,JSON.stringify(r)).toBe('SUCCESS');expect(r.routing.intent).toBe(intent);}});
  it('same-name parties, expenses, purchases, staff, needs and subscriptions remain isolated',async()=>{
    for(const q of ['customer Ramesh balance','Raj Traders se kitni purchase hui','business expenses today','supplier total due']){const r=await ask(q,{},B,other);expect(r.status,q).toBe('SUCCESS');expect(Object.values(r.result.summary).filter(v=>typeof v==='number').every(v=>v===0)).toBe(true);}
    expect((await ask('Rahul ne kitni sale ki',{},B,other)).result.summary.net_sales).toBe(999);expect((await ask('need list batao',{},B,other)).result.rows).toHaveLength(0);
    const subscription=await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:B.organization.id}});await db.tenantSubscription.update({where:{id:subscription.id},data:{expires_at:new Date(Date.now()+15*86400000)}});try{expect((await ask('subscription expiry date',{},B,other)).result.summary.expires).not.toBe((await ask('subscription expiry date')).result.summary.expires);}finally{await db.tenantSubscription.update({where:{id:subscription.id},data:{expires_at:subscription.expires_at}});}
  });
  it('auth guard rejects cross-tenant company, branch, FY and arbitrary context payload',async()=>{
    await http('post','assistant/query').set('X-Company-Id',B.company.id).send({message:'sales'}).expect(403);await http('post','assistant/query').set('X-Branch-Id',B.branch.id).send({message:'sales'}).expect(403);await http('post','assistant/query').set('X-Financial-Year-Id',B.financialYear.id).send({message:'sales'}).expect(403);
    for(const extra of [{company_id:B.company.id},{tool:'SQL'},{entity_id:customer.id},{sql:'SELECT 1'}]){const r=await http('post','assistant/query').send({message:'sales',...extra});expect([400,403]).toContain(r.status);}
    await request(app.getHttpServer()).post('/api/v1/assistant/query').send({message:'sales'}).expect(401);await http('post','assistant/query',A,platformToken).send({message:'sales'}).expect(401);
  });
  it('limited cashier cannot read financial, staff, dues, stock or diagnosis tools',async()=>{for(const q of ['aaj ki sale','aaj ka galla','customer Ramesh balance','supplier Mohan balance','Maggi stock','Rahul ne kitni sale ki','business expenses today','sale kam kyu hai','profit kam kyu hua','profit hai fir cash kyu nahi hai'])expect((await ask(q,{},A,staffToken)).status).toBe('PERMISSION_DENIED');});
  it('entitlement denied before entity lookup, even for owner',async()=>{
    const feature=await db.feature.findUniqueOrThrow({where:{code:'INVENTORY'}});await db.tenantEntitlement.update({where:{uix_tenant_entitlements:{organization_id:A.organization.id,feature_id:feature.id}},data:{is_enabled:false}});
    try{expect((await ask('Maggi stock')).status).toBe('FEATURE_NOT_ENTITLED');}finally{await db.tenantEntitlement.update({where:{uix_tenant_entitlements:{organization_id:A.organization.id,feature_id:feature.id}},data:{is_enabled:true}});}
  });
  it('date follow-up, entity follow-up and show-more retain safe context',async()=>{
    const first=await ask('aaj ki sale');const second=await ask('kal',{session_id:first.session_id,session_version:first.session_version});expect(second.result.summary.net_sales).toBe(0);expect(second.routing.router).toBe('CONTEXT');
    const who=await ask('customer Ramesh balance');expect((await ask('uska khata',{session_id:who.session_id,session_version:who.session_version})).routing.intent).toBe('CUSTOMER_KHATA');
    const needs=await ask('need list batao');expect(needs.result.rows).toHaveLength(5);expect(needs.result.hasMore).toBe(true);const more=await ask('aur dikhao',{session_id:needs.session_id,session_version:needs.session_version});expect(more.result.rows).toHaveLength(2);expect(more.result.hasMore).toBe(false);
  });
  it('historical stock/balance questions cannot silently return current numbers',async()=>{for(const q of ['kal Maggi stock','yesterday customer Ramesh balance','last month stock summary']){const r=await ask(q);expect(r.status).toBe('ERROR');expect(r.result).toBeUndefined();}});
  it('explicit Khata dates filter history while its current balance remains clearly labeled',async()=>{const r=await ask('yesterday customer Ramesh ledger');expect(r.status).toBe('SUCCESS');expect(r.result.rows).toHaveLength(0);expect(r.result.summary.balance).toBe(150);expect(r.result.definition).toContain('Current company-wide Khata balance');});
  it('missing legacy checkout snapshots cannot fabricate payment method or original credit',async()=>{const old=await db.salesInvoice.findUniqueOrThrow({where:{id:bill.id}});await db.salesInvoice.update({where:{id:bill.id},data:{payment_snapshot:Prisma.DbNull}});try{const r=await ask('cash sales today');expect(r.status).toBe('ERROR');expect(r.result).toBeUndefined();expect(r.text).toContain('will not guess');}finally{await db.salesInvoice.update({where:{id:bill.id},data:{payment_snapshot:old.payment_snapshot as Prisma.InputJsonValue}});}});
  it('conversation cannot cross tenant, user, login session, or stale version',async()=>{
    const r=await ask('aaj ki sale');for(const [shop,t] of [[B,other],[A,staffToken]])await http('post','assistant/query',shop,t).send({message:'kal',session_id:r.session_id,session_version:r.session_version}).expect(404);
    const login=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;await http('post','assistant/query',A,login).send({message:'kal',session_id:r.session_id,session_version:r.session_version}).expect(404);
    await ask('kal',{session_id:r.session_id,session_version:r.session_version});await http('post','assistant/query').send({message:'kal',session_id:r.session_id,session_version:r.session_version}).expect(409);
    await db.assistantConversation.update({where:{id:r.session_id},data:{expires_at:new Date(0)}});await http('post','assistant/query').send({message:'kal',session_id:r.session_id,session_version:r.session_version+1}).expect(404);
  });
  it('duplicate customer matches clarify; numeric choice never guesses',async()=>{
    await retail('post','customers',{name:'Ramesh Hardware'}).expect(201);await retail('post','customers',{name:'Ramesh Sharma'}).expect(201);
    const r=await ask('customer Ramesh H balance');expect(r.status).toBe('SUCCESS');
    const duplicate=(await retail('post','customers',{name:'Ramesh'}).expect(201)).body;
    try{const a=await ask('Ramesh ka balance');expect(a.status).toBe('AMBIGUOUS');expect(a.choices).toHaveLength(2);const selected=await ask('1',{session_id:a.session_id,session_version:a.session_version});expect(selected.status).toBe('SUCCESS');expect([0,150]).toContain(selected.result.summary.balance);}finally{await db.party.update({where:{id:duplicate.id},data:{is_active:false}});}
  });
  it('read-only writes, malformed questions and unsupported questions do not post data',async()=>{
    const before=await db.voucher.count({where:{company_id:A.company.id}});for(const q of ['delete bill '+bill.document_number,'add expense 100','weather today','select * from sales','pay supplier Mohan']){const r=await ask(q);expect(r.status).toBe('UNKNOWN');expect(r.result).toBeUndefined();}expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(before);
    await http('post','assistant/query').send({message:'x'.repeat(401)}).expect(400);await http('post','assistant/query').send({message:''}).expect(400);
  });
  it('persistent logs redact secrets and exclude financial answers',async()=>{
    await ask('password=SensitiveTestValue someone@test.invalid +919876543210');const log=await db.assistantQueryLog.findFirstOrThrow({where:{company_id:A.company.id},orderBy:{created_at:'desc'}});const json=JSON.stringify(log);expect(json).not.toContain('SensitiveTestValue');expect(json).not.toContain('someone@test.invalid');expect(json).not.toContain('9876543210');expect(json).not.toContain('net_sales');expect(log.timings).toHaveProperty('routing_ms');
  });
  it('Platform analytics require platform authorization and contain only aggregate diagnosis quality',async()=>{
    await http('get','platform/assistant/analytics').expect(401);const stats=(await platform('get','analytics').expect(200)).body;expect(stats.questions_today).toBeGreaterThan(50);expect(stats.latency.p95).toBeGreaterThan(0);expect(stats.diagnoses.total).toBeGreaterThan(0);expect(stats.diagnoses.p95).toBeGreaterThan(0);expect(stats.diagnoses.tracked_intents.map((i:any)=>i.intent_code)).toEqual(expect.arrayContaining(['WHY_SALES_DOWN','WHY_PROFIT_DOWN','SALES_VS_PROFIT_EXPLANATION','BUSINESS_PROBLEM_SIGNALS']));expect(JSON.stringify(stats)).not.toContain('password_hash');expect(JSON.stringify(stats)).not.toContain('net_sales');expect((await platform('get','intents').expect(200)).body).toHaveLength(INTENTS.length);expect((await platform('get','examples').expect(200)).body).toHaveLength(50);
  });
  it('human-approved unknown mapping learns immediately and approval is audited',async()=>{
    const phrase='audit-'+suffix+' rozgar sankhya';expect((await ask(phrase)).status).toBe('UNKNOWN');await platform('post','unknown/map').send({phrase,intent_code:'BILL_COUNT',language:'hinglish'}).expect(201);const r=await ask(phrase);expect(r.routing.router).toBe('EXACT');expect(r.routing.intent).toBe('BILL_COUNT');expect(r.status).toBe('SUCCESS');expect(await db.platformAuditLog.count({where:{user_id:actor,action:'ASSISTANT_EXAMPLE_APPROVED'}})).toBeGreaterThan(0);
    await platform('post','examples').send({phrase:'audit-'+suffix+' unsafe tool',intent_code:'ARBITRARY_SQL',language:'en'}).expect(400);await platform('post','examples').send({phrase:'password=abc',intent_code:'BILL_COUNT',language:'en'}).expect(400);
  });
  it('deactivation also blocks stored follow-up contexts and retired aliases persist',async()=>{
    const r=await ask('aaj ki sale');await platform('patch','intents/SALES_SUMMARY').send({active:false}).expect(200);try{expect((await ask('kal',{session_id:r.session_id,session_version:r.session_version})).status).toBe('ERROR');}finally{await platform('patch','intents/SALES_SUMMARY').send({active:true}).expect(200);}
    const phrase='audit-'+suffix+' retired phrase';const row=(await platform('post','examples').send({phrase,intent_code:'BILL_COUNT',language:'en'}).expect(201)).body;await platform('post','examples/'+row.id+'/retire').expect(201);await app.get(AssistantCatalogService).onModuleInit();expect((await db.assistantExample.findUniqueOrThrow({where:{id:row.id}})).active).toBe(false);
  });
  it('all posted accounting stays balanced and chat adds no stock movements',async()=>{const vouchers=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});for(const v of vouchers)expect(v.lines.reduce((s,l)=>s+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);expect(await db.stockMovement.count({where:{company_id:A.company.id,item_id:item.id}})).toBe(4);});
  it('variant names and explicit variant choices use their actual projections',async()=>{
    const product=(await retail('post','items',{name:'Shirt',selling_price:100,purchase_price:50,has_variants:true}).expect(201)).body;
    const red=(await retail('post',`items/${product.id}/variants`,{attributes:{colour:'Red'},sku:'SHIRT-RED'}).expect(201)).body,blue=(await retail('post',`items/${product.id}/variants`,{attributes:{colour:'Blue'},sku:'SHIRT-BLUE'}).expect(201)).body;
    await retail('post','purchases',{supplier_id:supplier.id,lines:[{item_id:product.id,variant_id:red.id,quantity:4,purchase_rate:50},{item_id:product.id,variant_id:blue.id,quantity:7,purchase_rate:50}],payment_status:'CREDIT',purchase_date:date}).expect(201);
    const r=await ask('Shirt Red stock');expect(r.status,JSON.stringify(r)).toBe('SUCCESS');expect(r.result.summary.quantity).toBe(4);
    const pending=await ask('Shirt stock');expect(pending.status).toBe('AMBIGUOUS');const n=pending.choices.find((c:any)=>c.label==='Blue').value;expect((await ask(n,{session_id:pending.session_id,session_version:pending.session_version})).result.summary.quantity).toBe(7);
    expect((await ask('Shirt Green stock')).status).toBe('ERROR');
  });
  it('unit conversion uses configured factors and refuses invented packet units',async()=>{
    expect((await ask('5 packet Maggi stock me hai')).status).toBe('ERROR');
    await retail('post',`items/${item.id}/unit-conversions`,{unit_code:'PACKET',conversion_factor:1}).expect(201);await retail('post',`items/${item.id}/unit-conversions`,{unit_code:'BOX',conversion_factor:5}).expect(201);
    const a=await ask('5 packet Maggi stock me hai');expect(a.status,JSON.stringify(a)).toBe('SUCCESS');expect(a.result.summary.available).toBe('Yes');const b=await ask('2 box Maggi stock');expect(b.status,JSON.stringify(b)).toBe('SUCCESS');expect(b.result.summary.quantity).toBe(2);expect(b.result.summary.unit).toBe('BOX');
  });
  it('location plus item is scoped to the actual store location',async()=>{
    await db.godown.update({where:{id:A.godown.id},data:{name:'Warehouse'}});try{const r=await ask('Warehouse mein Maggi kitni hai');expect(r.status,JSON.stringify(r)).toBe('SUCCESS');expect(r.result.rows).toHaveLength(1);expect(r.result.rows[0].item).toBe('Maggi');expect(r.result.rows[0].quantity).toBe(10);}finally{await db.godown.update({where:{id:A.godown.id},data:{name:'Main'}});}
  });
  it('soon-expiring and expired results come from positive received batch stock',async()=>{
    const product=(await retail('post','items',{name:'Dated Milk',selling_price:20,purchase_price:10,track_batch:true}).expect(201)).body;
    const soon=new Date(Date.now()+7*86400000).toISOString().slice(0,10);await retail('post','purchases',{supplier_id:supplier.id,lines:[{item_id:product.id,quantity:3,purchase_rate:10,batch_number:'SOON',expiry_date:soon},{item_id:product.id,quantity:2,purchase_rate:10,batch_number:'AGED',expiry_date:soon}],payment_status:'CREDIT',purchase_date:date}).expect(201);
    await db.itemBatch.updateMany({where:{company_id:A.company.id,item_id:product.id,batch_number:'AGED'},data:{expiry_date:new Date('2026-01-01')}});
    const soonAnswer=await ask('expiring items'),expired=await ask('expired items');expect(soonAnswer.result.rows.find((r:any)=>r.batch==='SOON').quantity).toBe(3);expect(expired.result.rows.find((r:any)=>r.batch==='AGED').quantity).toBe(2);expect((await ask('Dated Milk stock')).result.summary.quantity).toBe(3);
    expect((await ask('expired items',{},B,other)).result.rows).toHaveLength(0);
  });
  it('role ambiguity asks customer versus staff and preserves the choice',async()=>{
    await retail('post','customers',{name:'Rahul'}).expect(201);const r=await ask('Rahul ka hisab batao');expect(r.status).toBe('AMBIGUOUS');expect(r.choices.map((c:any)=>c.label)).toEqual(expect.arrayContaining(['Rahul · customer','Rahul · staff']));const n=r.choices.find((c:any)=>c.label==='Rahul · staff').value;expect((await ask(n,{session_id:r.session_id,session_version:r.session_version})).routing.intent).toBe('STAFF_SALES');
  });
  it('manager permissions grant reports but do not imply expense or Khata access',async()=>{
    const p=await db.permission.upsert({where:{code:'reports.read'},create:{code:'reports.read',module:'reports',resource:'reports',action:'read'},update:{}});const role=await db.role.create({data:{organization_id:A.organization.id,name:'ASSISTANT_MANAGER_'+suffix,role_permissions:{create:{permission_id:p.id}}}});
    const u=await db.user.create({data:{organization_id:A.organization.id,username:'assistant-manager-'+suffix+'@test.invalid',display_name:'Manager',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id,company_id:A.company.id,branch_id:A.branch.id}}}});const t=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:u.username,password}).expect(200)).body.access_token;
    expect((await ask('aaj ki sale',{},A,t)).status).toBe('SUCCESS');expect((await ask('aaj expense kitna hua',{},A,t)).status).toBe('PERMISSION_DENIED');expect((await ask('expenses compare karo',{},A,t)).status).toBe('PERMISSION_DENIED');expect((await ask('customer Ramesh balance',{},A,t)).status).toBe('PERMISSION_DENIED');
  });
});

