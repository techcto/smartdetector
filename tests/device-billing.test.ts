import {test} from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {productCatalog} from '../src/lib/products';
import {deviceQuantity,monthlyDeviceTotal,matchesDevicePrice,reconcileDeviceBilling,withBillingLock,DEVICE_BILLING_TERMS} from '../src/lib/device-billing';
import {store} from '../src/lib/store';

test('plan allowances and additional-device totals match the new monthly rates',()=>{
 const [free,starter,scale]=productCatalog();
 assert.equal(free.serverLimit,10);assert.equal(free.monthlyPrice,0);
 assert.equal(starter.serverLimit,25);assert.equal(scale.serverLimit,50);
 assert.equal(monthlyDeviceTotal(starter,0),49);assert.equal(monthlyDeviceTotal(starter,25),49);
 assert.equal(monthlyDeviceTotal(starter,30),59);assert.equal(monthlyDeviceTotal(scale,50),99);
 assert.equal(monthlyDeviceTotal(scale,60),119);
 assert.equal(deviceQuantity([]),1);assert.equal(deviceQuantity([{serverId:'a'},{serverId:'a'},{serverId:'b'}]),2);
});

test('billing lock serializes replicas and releases after errors',async()=>{
 let unblock!:()=>void;const gate=new Promise<void>(resolve=>{unblock=resolve;});
 const first=withBillingLock('lock-test',()=>gate);await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(await withBillingLock('lock-test',async()=>true),null);unblock();await first;
 await assert.rejects(withBillingLock('lock-test',async()=>{throw Error('retry');}));
 assert.equal(await withBillingLock('lock-test',async()=>true),true);
});

test('quantity sync prorates changes once, skips legacy consent and never substitutes an old flat price',async()=>{
 process.env.SMARTDETECTOR_DEPLOYMENT_MODE='saas';process.env.STRIPE_STARTER_PRICE_ID='price_devices';
 const org=await store.createOrganization({name:'Billing test',ownerId:'billing-test',orgType:'personal'});
 await store.putSubscription({id:'sub_devices',orgId:org.id,productId:'starter',stripeSubscriptionId:'sub_devices',status:'active',updatedAt:new Date().toISOString()});
 const now=new Date().toISOString();
 for(let index=0;index<28;index++)await store.upsertNode({tenantId:org.id,serverId:'device-'+index,agentId:'a',displayName:'Device',tags:[],status:'offline',createdAt:now,lastHeartbeat:now});
 const product=productCatalog()[1];
 const price={id:'price_devices',active:true,currency:'usd',billing_scheme:'tiered',tiers_mode:'graduated',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},tiers:[{up_to:25,flat_amount:4900,unit_amount:0},{up_to:null,flat_amount:0,unit_amount:200}]} as Stripe.Price;
 assert.ok(matchesDevicePrice(price,product));assert.ok(!matchesDevicePrice({...price,billing_scheme:'per_unit'},product));
 const subscription={id:'sub_devices',status:'active',cancel_at_period_end:false,metadata:{orgId:org.id,productId:'starter',deviceBillingTerms:DEVICE_BILLING_TERMS,deviceBillingRevision:'0'},items:{data:[{id:'si_devices',quantity:25,price}]}};
 const updates:{params:Stripe.SubscriptionUpdateParams;key:string}[]=[];let failNext=false;
 const client={subscriptions:{retrieve:async()=>subscription,update:async(_id:string,params:Stripe.SubscriptionUpdateParams,options:{idempotencyKey:string})=>{updates.push({params,key:options.idempotencyKey});if(failNext){failNext=false;throw Error('temporary failure');}subscription.items.data[0].quantity=params.items![0].quantity!;Object.assign(subscription.metadata,params.metadata);return subscription;}}} as unknown as Stripe;
 await reconcileDeviceBilling(org.id,client);await reconcileDeviceBilling(org.id,client);
 assert.equal(updates.length,1);assert.equal(updates[0].params.items![0].quantity,28);assert.equal(updates[0].params.proration_behavior,'create_prorations');
 subscription.items.data[0].quantity=30;
 await reconcileDeviceBilling(org.id,client);assert.equal(updates.length,2);assert.notEqual(updates[0].key,updates[1].key);
 subscription.metadata.deviceBillingTerms='legacy';subscription.items.data[0].quantity=1;
 await reconcileDeviceBilling(org.id,client);assert.equal(updates.length,2);
 subscription.metadata.deviceBillingTerms=DEVICE_BILLING_TERMS;subscription.items.data[0].price={...price,billing_scheme:'per_unit'};
 await assert.rejects(reconcileDeviceBilling(org.id,client),/price/);assert.equal(updates.length,2);
 subscription.items.data[0].price=price;subscription.items.data[0].quantity=25;failNext=true;
 await assert.rejects(reconcileDeviceBilling(org.id,client),/temporary failure/);
 await reconcileDeviceBilling(org.id,client);assert.equal(updates.length,4);assert.equal(updates[2].key,updates[3].key);assert.deepEqual(updates[2].params,updates[3].params);
 subscription.status='canceled';subscription.items.data[0].quantity=1;
 await reconcileDeviceBilling(org.id,client);assert.equal(updates.length,4);
 subscription.status='active';subscription.metadata.orgId='another-location';
 await reconcileDeviceBilling(org.id,client);assert.equal(updates.length,4);
 delete process.env.STRIPE_STARTER_PRICE_ID;
});
