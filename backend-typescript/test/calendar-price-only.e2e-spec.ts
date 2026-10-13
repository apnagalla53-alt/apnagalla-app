import { Test } from '@nestjs/testing';
import { INestApplication,RequestMethod,ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { businessDate } from '../src/common/business-date';
import { randomUUID } from 'crypto';
describe('Retail calendar, price-only catalog and payment greetings: actual HTTP',()=>{
  let app:INestApplication,db:PrismaService,A:any,B:any,token:string,other:string,item:any,supplier:any,customer:any,bill:any,task:any;
  const suffix=Date.now(),password='DisposableCalendar!827',date=businessDate(),month=date.slice(0,7);
  const call=(method:string,path:string,shop=A,t=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/retail/'+path).set('Authorization','Bearer '+t).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    for(const [name,set] of [['calendar-a-',(s:any)=>A=s],['calendar-b-',(s:any)=>B=s]] as const)set(await app.get(TenantProvisioningService).provisionTenant({organizationName:name+suffix,adminEmail:name+suffix+'@test.invalid',adminName:'Calendar Owner',adminPassword:password}));
    token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;
    other=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password}).expect(200)).body.access_token;
    supplier=(await call('post','suppliers').send({name:'Monthly wholesaler',visit_date:'2026-01-31',visit_cycle:'MONTHLY'}).expect(201)).body;
    customer=(await call('post','customers').send({name:'Customer promised today',credit_allowed:true}).expect(201)).body;
  });
  afterAll(async()=>{if(A)await db.retailCalendarTask.deleteMany({where:{company_id:A.company.id}});if(app)await app.close();});
  it('saves an ordinary price-only item without any fabricated stock',async()=>{
    item=(await call('post','items').send({name:'New uncounted item',selling_price:500,inventory_tracking:false}).expect(201)).body;
    expect(item.inventory_tracking).toBe(false);expect(item.item_type).toBe('STOCK_ITEM');expect(await db.stockMovement.count({where:{item_id:item.id}})).toBe(0);
    expect((await call('get','items?search=New%20uncounted').expect(200)).body[0].id).toBe(item.id);
  });
  it('filters physical low/out stock before paging, searches barcode and rejects cross-tenant catalog results',async()=>{
    const low=(await call('post','items').send({name:'UX low bottle',selling_price:85,opening_stock:2,low_stock_threshold:3,barcode:'UX-BAR-'+suffix,category:'My custom category'}).expect(201)).body;
    const zero=(await call('post','items').send({name:'UX zero bottle',selling_price:85,opening_stock:0}).expect(201)).body;
    await call('post','items').send({name:'AAA plentiful',selling_price:85,opening_stock:10,low_stock_threshold:1}).expect(201);
    expect((await call('get','items?stock_status=low&limit=1&offset=0').expect(200)).body.map((r:any)=>r.id)).toEqual([low.id]);
    expect((await call('get','items?stock_status=low&limit=1&offset=1').expect(200)).body.map((r:any)=>r.id)).toEqual([zero.id]);
    expect((await call('get','items?stock_status=out').expect(200)).body.map((r:any)=>r.id)).toEqual([zero.id]);
    expect((await call('get','items?stock_status=low&search=UX-BAR-'+suffix).expect(200)).body.map((r:any)=>r.id)).toEqual([low.id]);
    expect((await call('get','items?search=UX-BAR-'+suffix).expect(200)).body.map((r:any)=>r.id)).toEqual([low.id]);
    expect((await call('get','items?stock_status=low',B,other).expect(200)).body).toEqual([]);
    expect((await call('get','item-categories?search=custom').expect(200)).body).toEqual(['My custom category']);
    expect((await call('get','item-categories',B,other).expect(200)).body).toEqual([]);
    expect((await call('get','items?stock_status=low&search='+encodeURIComponent("' OR 1=1 --")).expect(200)).body).toEqual([]);
    await call('get','items?stock_status=unknown').expect(400);
  });
  it('bills an uncounted item and preserves the exact cash/UPI split without stock deduction',async()=>{
    bill=(await call('post','bills').send({items:[{item_id:item.id,quantity:1,rate:500}],payment_splits:[{method:'CASH',amount:250},{method:'UPI',amount:250}],date}).expect(201)).body;
    const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:bill.id}});expect(line.inventory_tracked).toBe(false);
    const detail=(await call('get','bills/'+bill.id).expect(200)).body;expect(detail.payments).toEqual([{method:'CASH',amount:250},{method:'UPI',amount:250}]);expect(await db.stockMovement.count({where:{item_id:item.id}})).toBe(0);
  });
  it('posts Cash + UPI + remaining Udhar once, with balanced journals and a calendar promise',async()=>{
    const splitCustomer=(await call('post','customers').send({name:'Split payment customer',credit_allowed:true,credit_limit:250}).expect(201)).body;
    const before=(await call('get','galla?date='+date).expect(200)).body;
    const invoicesBefore=await db.salesInvoice.count({where:{company_id:A.company.id}});
    const key=randomUUID(),body={items:[{item_id:item.id,quantity:1,rate:500}],customer_id:splitCustomer.id,
      payment_splits:[{method:'CASH',amount:100},{method:'UPI',amount:150}],date,due_date:date};
    const responses=await Promise.all([1,2,3].map(()=>call('post','bills').set('Idempotency-Key',key).send(body).expect(201)));
    expect(new Set(responses.map(r=>r.body.id)).size).toBe(1);
    expect(await db.salesInvoice.count({where:{company_id:A.company.id}})).toBe(invoicesBefore+1);
    const invoice=responses[0].body;
    expect(Number(invoice.outstanding_amount)).toBe(250);
    const detail=(await call('get','bills/'+invoice.id).expect(200)).body;
    expect(detail.payments).toEqual([{method:'CASH',amount:100},{method:'UPI',amount:150}]);
    const journals=await db.voucher.findMany({where:{company_id:A.company.id,source_document_id:invoice.id,status:'POSTED'},include:{lines:true}});
    expect(journals).toHaveLength(2);
    for(const journal of journals)expect(journal.lines.reduce((sum,l)=>sum+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
    const receipt=journals.find(j=>j.source_document_type==='POS_RECEIPT')!;
    expect(receipt.lines.reduce((sum,l)=>sum+Number(l.debit),0)).toBe(250);
    const after=(await call('get','galla?date='+date).expect(200)).body;
    expect(after.cash_sales-before.cash_sales).toBe(100);expect(after.upi_sales-before.upi_sales).toBe(150);
    expect(after.udhar_sales-before.udhar_sales).toBe(250);expect(after.expected_cash-before.expected_cash).toBe(100);
    const reminder=(await call('get','calendar?month='+month).expect(200)).body.receivables.find((r:any)=>r.id===invoice.id);
    expect(Number(reminder.outstanding_amount)).toBe(250);expect(reminder.due_date.slice(0,10)).toBe(date);
    expect((await call('get','calendar?month='+month,B,other).expect(200)).body.receivables.some((r:any)=>r.id===invoice.id)).toBe(false);
    await call('post','bills').set('Idempotency-Key',key).send({...body,payment_splits:[{method:'CASH',amount:500}]}).expect(409);
    await call('post','customers/'+splitCustomer.id+'/payments').send({amount:250,payment_method:'CASH',date}).expect(201);
    expect((await call('get','calendar?month='+month).expect(200)).body.receivables.some((r:any)=>r.id===invoice.id)).toBe(false);
  });
  it('rejects split credit without an eligible tenant customer, overpayment and earlier promise dates atomically',async()=>{
    const disabled=(await call('post','customers').send({name:'Cash only customer',credit_allowed:false}).expect(201)).body;
    const limited=(await call('post','customers').send({name:'Low credit customer',credit_allowed:true,credit_limit:100}).expect(201)).body;
    const foreign=(await call('post','customers',B,other).send({name:'Other tenant customer',credit_allowed:true}).expect(201)).body;
    const body={items:[{item_id:item.id,quantity:1,rate:500}],payment_splits:[{method:'CASH',amount:100},{method:'UPI',amount:150}],date};
    const before={invoices:await db.salesInvoice.count({where:{company_id:A.company.id}}),vouchers:await db.voucher.count({where:{company_id:A.company.id}})};
    for(const extra of [{},{customer_id:disabled.id},{customer_id:limited.id},{customer_id:foreign.id},
      {customer_id:customer.id,due_date:new Date(new Date(date).getTime()-86400000).toISOString().slice(0,10)},
      {payment_splits:[{method:'CASH',amount:300},{method:'UPI',amount:250}]},
      {customer_id:customer.id,payment_splits:[{method:'CASH',amount:250},{method:'UDHAR',amount:250}]}]){
      await call('post','bills').send({...body,...extra}).expect(400);
    }
    expect(await db.salesInvoice.count({where:{company_id:A.company.id}})).toBe(before.invoices);
    expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(before.vouchers);
    expect(await db.stockMovement.count({where:{item_id:item.id}})).toBe(0);
  });
  it('generates only the selected UPI portion without confirming receipt or adding a journal',async()=>{
    await call('post','payments/upi').send({upi_id:'split.test@upi',payee_name:'Split Test Shop',show_on_invoice:true}).expect(201);
    const before=await db.voucher.count({where:{company_id:A.company.id}});
    const qr=(await call('get','payments/upi/qr?amount=150').expect(200)).body;
    expect(new URL(qr.uri).searchParams.get('am')).toBe('150.00');expect(qr.automatic_confirmation).toBe(false);
    expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(before);
  });
  it('an actual purchase starts stock counting from the actual received quantity',async()=>{
    await call('post','purchases').send({supplier_id:supplier.id,lines:[{item_id:item.id,quantity:5,purchase_rate:100}],payment_status:'CREDIT',purchase_date:date}).expect(201);
    expect((await db.item.findUniqueOrThrow({where:{id:item.id}})).inventory_tracking).toBe(true);
    expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id},_sum:{quantity:true}}))._sum.quantity)).toBe(5);
  });
  it('returning the earlier uncounted bill does not add phantom stock after tracking starts',async()=>{
    const detail=(await call('get','bills/'+bill.id).expect(200)).body;
    await call('post','bills/return').send({original_invoice_id:bill.id,refund_method:'CASH',lines:[{item_id:item.id,original_line_id:detail.sales_invoice_line[0].id,quantity:1,rate:500}]}).expect(201);
    expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id},_sum:{quantity:true}}))._sum.quantity)).toBe(5);
  });
  it('the now-tracked item still rejects overselling',async()=>{
    await call('post','bills').send({items:[{item_id:item.id,quantity:6,rate:500}],payment_splits:[{method:'CASH',amount:3000}],date}).expect(400);
  });
  it('rejects uncounted advanced tracking and turning counted stock off',async()=>{
    await call('post','items').send({name:'Invalid stock bypass',selling_price:100,inventory_tracking:false,opening_stock:1}).expect(400);
    await call('post','items/'+item.id).send({inventory_tracking:false}).expect(400);
  });
  it('monthly supplier recurrence clamps Jan 31 to February 28 and resumes March 31',async()=>{
    const feb=(await call('get','calendar?month=2026-02').expect(200)).body;expect(feb.visits.map((v:any)=>v.date)).toEqual(['2026-02-28']);
    const mar=(await call('get','calendar?month=2026-03').expect(200)).body;expect(mar.visits.map((v:any)=>v.date)).toEqual(['2026-03-31']);
  });
  it('weekly supplier visits repeat only after the configured anchor',async()=>{
    await call('patch','calendar/suppliers/'+supplier.id).send({date:'2026-10-07',cycle:'WEEKLY'}).expect(200);
    const result=(await call('get','calendar?month=2026-10').expect(200)).body;expect(result.visits.map((v:any)=>v.date)).toEqual(['2026-10-07','2026-10-14','2026-10-21','2026-10-28']);
  });
  it('unpaid customer due dates appear and disappear after actual collection',async()=>{
    const credit=(await call('post','bills/amount-sale').send({amount:100,payment_method:'UDHAR',customer_id:customer.id,date,due_date:date}).expect(201)).body;
    expect((await call('get','calendar?month='+month).expect(200)).body.receivables.some((r:any)=>r.id===credit.id)).toBe(true);
    await call('post','customers/'+customer.id+'/payments').send({amount:100,payment_method:'CASH',date}).expect(201);
    expect((await call('get','calendar?month='+month).expect(200)).body.receivables.some((r:any)=>r.id===credit.id)).toBe(false);
  });
  it('creates, completes and isolates real tasks and supplier schedules',async()=>{
    task=(await call('post','calendar/tasks').send({title:'Call supplier',date}).expect(201)).body;
    expect((await call('get','calendar?month='+month).expect(200)).body.tasks.some((t:any)=>t.id===task.id)).toBe(true);
    expect((await call('get','calendar?month='+month,B,other).expect(200)).body.tasks).toHaveLength(0);
    await call('patch','calendar/tasks/'+task.id,B,other).send({completed:true}).expect(404);
    await call('patch','calendar/suppliers/'+supplier.id,B,other).send({date,cycle:'NONE'}).expect(404);
    await call('patch','calendar/tasks/'+task.id).send({completed:true}).expect(200);expect((await db.retailCalendarTask.findUniqueOrThrow({where:{id:task.id}})).completed).toBe(true);
  });
  it('validates real dates and authoritative holiday coverage',async()=>{
    await call('get','calendar?month=2026-13').expect(400);
    await call('post','calendar/tasks').send({title:'Invalid date',date:'2026-02-31'}).expect(400);
    const oct=(await call('get','calendar?month=2026-10').expect(200)).body;expect(oct.holidays.find((h:any)=>h.title==='Dussehra').date).toBe('2026-10-20');expect(oct.holidays.some((h:any)=>h.date==='2026-10-07')).toBe(false);
    expect((await call('get','calendar?month=2027-10').expect(200)).body.holidays).toHaveLength(0);
  });
  it('persists a configurable greeting without leaking across tenants',async()=>{
    await call('post','checkout-voice').send({enabled:true,text:'Thank you for visiting {shop}',language:'hi-IN',rate:0.9}).expect(201);
    expect((await call('get','checkout-voice').expect(200)).body.enabled).toBe(true);
    const otherDefault=(await call('get','checkout-voice',B,other).expect(200)).body;
    expect(otherDefault.enabled).toBe(true);
    expect(otherDefault.language).toBe('en-IN');
    expect(otherDefault.text).toBe('Thank you for visiting {shop}. Please visit again.');
    await call('post','checkout-voice').send({enabled:false,text:'Thank you for visiting {shop}',language:'hi-IN',rate:0.9}).expect(201);
    expect((await call('get','checkout-voice').expect(200)).body.enabled).toBe(false);
    expect((await call('get','checkout-voice',B,other).expect(200)).body.enabled).toBe(true);
    await call('post','checkout-voice').send({enabled:true,text:'',language:'hi-IN'}).expect(400);
  });
  it('retains balanced accounting for price-only sales, purchases, collection and refunds',async()=>{
    const vouchers=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});
    for(const v of vouchers)expect(v.lines.reduce((sum,l)=>sum+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
  });
});
