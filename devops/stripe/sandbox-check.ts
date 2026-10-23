import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Stripe from 'stripe';
import {NextRequest} from 'next/server';

// Explicitly sandbox-only. This script never reads/writes the production app table.
async function main(){
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key||!/^(sk|rk)_test_/.test(key))throw Error('A Stripe sandbox key is required; live keys are refused');
 if(process.env.SMARTDETECTOR_TABLE||process.env.NODE_ENV==='production')throw Error('Run in an isolated local process, never against a deployed application');
 const run=randomUUID();
 Object.assign(process.env,{SMARTDETECTOR_DEPLOYMENT_MODE:'saas',SMARTDETECTOR_STRIPE_MODE:'sandbox',SMARTDETECTOR_PUBLIC_ORIGIN:'https://localhost',SMARTDETECTOR_SESSION_SECRET:randomUUID()+randomUUID(),STRIPE_WEBHOOK_SECRET:'whsec_'+randomUUID().replaceAll('-','')});
 const client=new Stripe(key,{timeout:20000,maxNetworkRetries:1});
 const {setup}=await import('./setup-plans.mjs');
 const {store}=await import('../../src/lib/store');
 const {createSession,sessionCookie}=await import('../../src/lib/session');
 const {reconcileDeviceBilling,DEVICE_BILLING_TERMS}=await import('../../src/lib/device-billing');
 const {POST:checkout}=await import('../../src/app/api/billing/checkout/route');
 const {POST:webhook}=await import('../../src/app/api/billing/webhook/route');
 const prices=await setup(client);Object.assign(process.env,prices);
 let clock:string|undefined,checkoutId:string|undefined;
 const stage=(value:string)=>console.log(JSON.stringify({stage:value}));
 async function advance(id:string,time:number){
  await client.testHelpers.testClocks.advance(id,{frozen_time:time});
  for(let attempt=0;attempt<50;attempt++){const value=await client.testHelpers.testClocks.retrieve(id);if(value.status==='ready')return;await new Promise(resolve=>setTimeout(resolve,1000));}
  throw Error('Stripe test clock did not stabilize');
 }
 try{
  const org=await store.createOrganization({name:'Sandbox billing '+run,ownerId:'sandbox-'+run,orgType:'personal'});
  const token=await createSession({id:'root',username:'sandbox',role:'root',orgId:org.id,expiresAt:Date.now()+3600000},process.env.SMARTDETECTOR_SESSION_SECRET!);
  const now=new Date().toISOString();
  async function add(index:number){await store.upsertNode({tenantId:org.id,serverId:'sandbox-device-'+index,agentId:'sandbox',displayName:'Sandbox device',tags:[],status:'offline',createdAt:now,lastHeartbeat:now});}
  for(let index=0;index<25;index++)await add(index);
  const request=(accept:boolean)=>new NextRequest('https://localhost/api/billing/checkout',{method:'POST',headers:{host:'localhost',origin:'https://localhost','content-type':'application/json',cookie:sessionCookie+'='+token},body:JSON.stringify({productId:'starter',acceptDeviceBilling:accept})});
  assert.equal((await checkout(request(false))).status,400);
  const started=await checkout(request(true));assert.equal(started.status,200,await started.clone().text());
  const body=await started.json();checkoutId=String(body.url).match(/\/(cs_test_[^/#?]+)/)?.[1];assert.ok(checkoutId);
  const session=await client.checkout.sessions.retrieve(checkoutId);
  assert.equal(session.livemode,false);assert.equal(session.metadata?.deviceBillingTerms,DEVICE_BILLING_TERMS);
  assert.equal((await client.checkout.sessions.listLineItems(checkoutId)).data[0].quantity,25);
  const again=await (await checkout(request(true))).json();assert.equal(again.url,body.url,'retries reuse the same payable checkout');
  await store.upsertNode({tenantId:org.id,serverId:'checkout-extra',agentId:'sandbox',displayName:'Checkout-only device',tags:[],status:'offline',createdAt:now,lastHeartbeat:now});
  const changed=await checkout(request(true));assert.equal(changed.status,200);
  assert.equal((await client.checkout.sessions.retrieve(checkoutId)).status,'expired','changing the inventory expires the old payable session');
  checkoutId=String((await changed.json()).url).match(/\/(cs_test_[^/#?]+)/)?.[1];assert.ok(checkoutId);
  await store.detachDevice(org.id,'checkout-extra');
  await client.checkout.sessions.expire(checkoutId);checkoutId=undefined;
  stage('checkout request and explicit consent passed');

  clock=(await client.testHelpers.testClocks.create({frozen_time:Math.floor(Date.now()/1000),name:'SmartDetector sandbox '+run})).id;
  const customer=await client.customers.create({name:'SmartDetector sandbox '+run,test_clock:clock,metadata:{sandbox_run:run}});
  const method=await client.paymentMethods.create({type:'card',card:{token:'tok_visa'}});
  await client.paymentMethods.attach(method.id,{customer:customer.id});
  await client.customers.update(customer.id,{invoice_settings:{default_payment_method:method.id}});
  const scale=await client.invoices.createPreview({customer:customer.id,subscription_details:{items:[{price:prices.STRIPE_SCALE_PRICE_ID,quantity:60}]}});
  assert.equal(scale.amount_due,11900);stage('Scale 60-device preview is $119');
  let subscription=await client.subscriptions.create({customer:customer.id,items:[{price:prices.STRIPE_STARTER_PRICE_ID,quantity:25}],metadata:{orgId:org.id,productId:'starter',deviceBillingTerms:DEVICE_BILLING_TERMS,deviceBillingRevision:'0'},expand:['latest_invoice']});
  assert.equal(subscription.status,'active');assert.equal((subscription.latest_invoice as Stripe.Invoice).amount_paid,4900);
  const deliver=async(value:Stripe.Subscription)=>{
   const payload=JSON.stringify({id:'evt_sandbox_'+randomUUID(),object:'event',type:value.status==='canceled'?'customer.subscription.deleted':'customer.subscription.updated',data:{object:value}});
   const signature=client.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET!});
   const result=await webhook(new NextRequest('https://localhost/api/billing/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}));assert.equal(result.status,200);
  };
  await deliver(subscription);assert.equal((await store.activeSubscriptionForOrg(org.id))?.stripeSubscriptionId,subscription.id);
  const item=subscription.items.data[0],middle=Math.floor((item.current_period_start+item.current_period_end)/2);
  await advance(clock,middle);
  for(let index=25;index<30;index++)await add(index);
  await reconcileDeviceBilling(org.id,client);
  subscription=await client.subscriptions.retrieve(subscription.id);
  assert.equal(subscription.items.data[0].quantity,30);assert.equal(subscription.metadata.deviceBillingRevision,'1');
  const added=await client.invoices.createPreview({customer:customer.id,subscription:subscription.id});
  assert.ok(added.lines.data.some(line=>line.parent?.subscription_item_details?.proration&&line.amount>0));
  await reconcileDeviceBilling(org.id,client);
  assert.equal((await client.subscriptions.retrieve(subscription.id)).metadata.deviceBillingRevision,'1');
  for(let index=27;index<30;index++)await store.detachDevice(org.id,'sandbox-device-'+index);
  await reconcileDeviceBilling(org.id,client);
  subscription=await client.subscriptions.retrieve(subscription.id);assert.equal(subscription.items.data[0].quantity,27);
  const removed=await client.invoices.createPreview({customer:customer.id,subscription:subscription.id});
  assert.ok(removed.lines.data.some(line=>line.parent?.subscription_item_details?.proration&&line.amount<0));
  assert.ok(Math.abs(removed.amount_due-5500)<=2,`Unexpected prorated next invoice: ${removed.amount_due}`);
  stage('Starter additions, removals, signed webhook and duplicate-sync checks passed');
  await advance(clock,item.current_period_end+7200);
  const invoices=await client.invoices.list({customer:customer.id,subscription:subscription.id,limit:10});
  const renewal=invoices.data.find(invoice=>invoice.billing_reason==='subscription_cycle');assert.ok(renewal);
  assert.equal(renewal.status,'paid');assert.ok(Math.abs(renewal.amount_paid-5500)<=2);
  stage('sandbox renewal automatically paid the prorated invoice');
  subscription=await client.subscriptions.cancel(subscription.id);await deliver(subscription);
  assert.equal(await store.activeSubscriptionForOrg(org.id),null);
  await reconcileDeviceBilling(org.id,client);stage('cancellation stopped further quantity billing');
 }finally{
  if(checkoutId)await client.checkout.sessions.expire(checkoutId).catch(()=>{});
  if(clock)await client.testHelpers.testClocks.del(clock);
  stage('sandbox simulation resources cleaned up; reusable test catalog retained');
 }
}
main().catch(error=>{console.error(JSON.stringify({error:error instanceof Error?error.message:'Sandbox verification failed'}));process.exitCode=1;});
