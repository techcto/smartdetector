import {test} from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {checkoutForWorkspace} from '../src/lib/billing-checkout';
import {stripe} from '../src/lib/stripe';
import {localEmulation} from '../src/lib/local-emulation';
import {localAuthLinks} from '../src/lib/signup-policy';

test('production-built localhost auth needs the complete isolated emulator boundary',()=>{
 const keys=['NODE_ENV','SMARTDETECTOR_DEPLOYMENT_MODE','SMARTDETECTOR_LOCAL_REPLAY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','SMARTDETECTOR_TABLE','SMARTDETECTOR_DYNAMODB_ENDPOINT'];const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{Object.assign(process.env,{NODE_ENV:'production',SMARTDETECTOR_DEPLOYMENT_MODE:'saas',SMARTDETECTOR_LOCAL_REPLAY:'true'});assert.equal(localEmulation(),false);assert.equal(localAuthLinks(),false);
 Object.assign(process.env,{AWS_ACCESS_KEY_ID:'local',AWS_SECRET_ACCESS_KEY:'local',SMARTDETECTOR_TABLE:'smartdetector-local',SMARTDETECTOR_DYNAMODB_ENDPOINT:'http://smartdetector-dynamodb:8000'});assert.equal(localEmulation(),true);assert.equal(localAuthLinks(),true);
 process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT='https://dynamodb.us-east-1.amazonaws.com';assert.equal(localEmulation(),false);assert.equal(localAuthLinks(),false);
 }finally{for(const key of keys)if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
});

test('completed checkout permits repurchase only after Stripe confirms workspace cancellation',async()=>{
 let status='active',orgId='repurchase';let created=0;
 const client={checkout:{sessions:{create:async()=>({id:'cs_'+(++created),status:'complete',subscription:'sub_previous'}),retrieve:async()=>({id:'cs_1',status:'complete',subscription:'sub_previous'})}},subscriptions:{retrieve:async()=>({id:'sub_previous',status,metadata:{orgId}})}} as unknown as Stripe;
 const params:Stripe.Checkout.SessionCreateParams={mode:'subscription',success_url:'https://localhost/success'};
 await checkoutForWorkspace('repurchase',params,client);
 await assert.rejects(checkoutForWorkspace('repurchase',params,client),/completed/);
 status='canceled';orgId='another-workspace';
 await assert.rejects(checkoutForWorkspace('repurchase',params,client),/completed/);
 orgId='repurchase';await checkoutForWorkspace('repurchase',params,client);
 assert.equal(created,2);
});

test('local sandbox and production live keys cannot be swapped',()=>{
 const oldKey=process.env.STRIPE_SECRET_KEY,oldMode=process.env.SMARTDETECTOR_STRIPE_MODE;
 try{process.env.SMARTDETECTOR_STRIPE_MODE='sandbox';process.env.STRIPE_SECRET_KEY='sk_live_synthetic';assert.throws(stripe,/environment/);
 process.env.SMARTDETECTOR_STRIPE_MODE='live';process.env.STRIPE_SECRET_KEY='sk_test_synthetic';assert.throws(stripe,/environment/);
 }finally{if(oldKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldKey;if(oldMode===undefined)delete process.env.SMARTDETECTOR_STRIPE_MODE;else process.env.SMARTDETECTOR_STRIPE_MODE=oldMode;}
});

test('checkout retries recover the same attempt, expire superseded sessions and block duplicate completed purchases',async()=>{
 const sessions=new Map<string,{id:string;status:string;url:string}>(),attempts=new Map<string,string>();let calls=0,loseResponse=true;
 const client={checkout:{sessions:{create:async(_params:unknown,options:{idempotencyKey:string})=>{
  calls++;let id=attempts.get(options.idempotencyKey);if(!id){id='cs_test_'+attempts.size;attempts.set(options.idempotencyKey,id);sessions.set(id,{id,status:'open',url:'https://checkout.example/'+id});}
  if(loseResponse){loseResponse=false;throw Error('lost response');}return sessions.get(id);
 },retrieve:async(id:string)=>sessions.get(id),expire:async(id:string)=>{sessions.get(id)!.status='expired';return sessions.get(id);}}}} as unknown as Stripe;
 const params:Stripe.Checkout.SessionCreateParams={mode:'subscription',line_items:[{price:'price_test',quantity:25}],success_url:'https://localhost/success'};
 await assert.rejects(checkoutForWorkspace('retry-checkout',params,client),/lost response/);
 const first=await checkoutForWorkspace('retry-checkout',params,client);
 assert.equal(attempts.size,1);assert.equal(calls,2);
 assert.equal((await checkoutForWorkspace('retry-checkout',params,client)).id,first.id);assert.equal(calls,2);
 const changed=await checkoutForWorkspace('retry-checkout',{...params,line_items:[{price:'price_test',quantity:26}]},client);
 assert.equal(sessions.get(first.id)!.status,'expired');assert.notEqual(changed.id,first.id);
 sessions.get(changed.id)!.status='complete';
 await assert.rejects(checkoutForWorkspace('retry-checkout',params,client),/completed/);assert.equal(attempts.size,2);
});

test('a checkout Stripe rejected is not replayed: the next try starts a fresh attempt with the current params',async()=>{
 const keys:string[]=[],sent:unknown[]=[];let reject=true;
 const refuse=()=>Object.assign(Error('custom_text cannot be used with Managed Payments'),{type:'StripeInvalidRequestError'});
 const client={checkout:{sessions:{create:async(params:unknown,options:{idempotencyKey:string})=>{keys.push(options.idempotencyKey);sent.push(params);if(reject)throw refuse();return {id:'cs_fixed',status:'open',url:'https://checkout.example/cs_fixed'};}}}} as unknown as Stripe;
 const failing:Stripe.Checkout.SessionCreateParams={mode:'subscription',custom_text:{submit:{message:'25 devices included'}},success_url:'https://localhost/success'};
 await assert.rejects(checkoutForWorkspace('rejected-checkout',failing,client),/Managed Payments/);
 await assert.rejects(checkoutForWorkspace('rejected-checkout',failing,client),/Managed Payments/);
 assert.equal(new Set(keys).size,2,'a rejected attempt is cleared, not replayed under its old idempotency key');
 reject=false;const fixed={...failing,managed_payments:{enabled:false}};
 assert.equal((await checkoutForWorkspace('rejected-checkout',fixed,client)).id,'cs_fixed');
 assert.deepEqual(sent.at(-1),fixed);assert.equal(new Set(keys).size,3);
});

test('a saved attempt from before the fix is replayed once; when Stripe refuses it, the current params get a new attempt',async()=>{
 const keys:string[]=[];const failed=new Set<string>();
 const client={checkout:{sessions:{create:async(params:{managed_payments?:unknown},options:{idempotencyKey:string})=>{keys.push(options.idempotencyKey);if(!params.managed_payments||failed.has(options.idempotencyKey)){failed.add(options.idempotencyKey);throw Object.assign(Error('stored 400'),{type:'StripeInvalidRequestError'});}return {id:'cs_new',status:'open',url:'u'};}}}} as unknown as Stripe;
 const old:Stripe.Checkout.SessionCreateParams={mode:'subscription',success_url:'https://localhost/success'};
 // Simulate the stuck record: the first call saves the attempt, and a lost connection (not a Stripe refusal) leaves it behind.
 const lost={checkout:{sessions:{create:async()=>{throw Error('lost response')}}}} as unknown as Stripe;
 await assert.rejects(checkoutForWorkspace('stuck-checkout',old,lost),/lost response/);
 const session=await checkoutForWorkspace('stuck-checkout',{...old,managed_payments:{enabled:false}},client);
 assert.equal(session.id,'cs_new');assert.equal(keys.length,2);assert.notEqual(keys[0],keys[1]);
});
