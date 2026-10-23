import {createHash,randomUUID} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DeleteCommand,DynamoDBDocumentClient,GetCommand,PutCommand} from '@aws-sdk/lib-dynamodb';
import type Stripe from 'stripe';

type PendingCheckout={attempt:string;fingerprint:string;createdAt:number;params:Stripe.Checkout.SessionCreateParams;sessionId?:string};
const table=process.env.SMARTDETECTOR_TABLE;
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const memory=new Map<string,PendingCheckout>();
const key=(org:string)=>({pk:'ORG#'+org,sk:'BILLING_CHECKOUT'});
async function load(org:string):Promise<PendingCheckout|null>{if(!table)return memory.get(org)??null;return (await db.send(new GetCommand({TableName:table,Key:key(org),ConsistentRead:true}))).Item as PendingCheckout??null;}
async function save(org:string,value:PendingCheckout){if(table)await db.send(new PutCommand({TableName:table,Item:{...key(org),...value}}));else memory.set(org,value);}
async function clear(org:string){if(table)await db.send(new DeleteCommand({TableName:table,Key:key(org)}));else memory.delete(org);}
// Stripe refused the request itself, so no session exists; its idempotent replay would refuse every retry the same way.
const rejected=(error:unknown)=>(error as {type?:string})?.type==='StripeInvalidRequestError';
export class CheckoutPending extends Error{}

// Caller holds the shared workspace billing lock. Persist the exact request BEFORE
// contacting Stripe, so a timeout retries the same idempotent attempt, not a second purchase.
export async function checkoutForWorkspace(org:string,params:Stripe.Checkout.SessionCreateParams,client:Stripe){
 const fingerprint=createHash('sha256').update(JSON.stringify(params)).digest('hex');
 let pending=await load(org),previous:Stripe.Checkout.Session|null=null;
 if(pending){
  if(!pending.sessionId&&Date.now()-pending.createdAt>23*3600000)throw new CheckoutPending('A previous checkout could not be confirmed. Contact support before starting another subscription.');
  try{previous=pending.sessionId?await client.checkout.sessions.retrieve(pending.sessionId):await client.checkout.sessions.create(pending.params,{idempotencyKey:'checkout:'+pending.attempt});}
  catch(error){if(pending.sessionId||!rejected(error))throw error;await clear(org);}
 }
 if(pending&&previous){
  const session=previous;
  if(!pending.sessionId){pending={...pending,sessionId:session.id};await save(org,pending);}
  if(session.status==='complete'){
   const id=typeof session.subscription==='string'?session.subscription:session.subscription?.id;
   const subscription=id?await client.subscriptions.retrieve(id):null;
   // A completed purchase remains a duplicate-purchase barrier until Stripe
   // confirms that this workspace's previous subscription really ended.
   if(!subscription||subscription.metadata.orgId!==org||!['canceled','incomplete_expired'].includes(subscription.status))throw new CheckoutPending('Your checkout completed. Please wait for subscription confirmation or contact support.');
  }
  if(session.status==='open'&&pending.fingerprint===fingerprint)return session;
  if(session.status==='open')await client.checkout.sessions.expire(session.id);
 }
 pending={attempt:randomUUID(),fingerprint,createdAt:Date.now(),params};
 await save(org,pending);
 let session:Stripe.Checkout.Session;
 try{session=await client.checkout.sessions.create(params,{idempotencyKey:'checkout:'+pending.attempt});}
 catch(error){if(rejected(error))await clear(org);throw error;}
 await save(org,{...pending,sessionId:session.id});return session;
}
