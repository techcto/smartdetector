import {randomUUID} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,PutCommand,DeleteCommand} from '@aws-sdk/lib-dynamodb';
import type Stripe from 'stripe';
import {store} from './store';
import {stripe} from './stripe';
import type {Node,Product} from './model';

export const DEVICE_BILLING_TERMS='devices-v2';
const table=process.env.SMARTDETECTOR_TABLE;
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const locks=new Set<string>();
export const deviceQuantity=(nodes:Pick<Node,'serverId'>[])=>Math.max(1,new Set(nodes.map(node=>node.serverId)).size);
export const monthlyDeviceTotal=(product:Product,count:number)=>product.monthlyPrice+Math.max(0,count-product.serverLimit)*(product.extraDeviceMonthlyPrice??0);

export function matchesDevicePrice(price:Stripe.Price,product:Product){
 const tiers=price.tiers;
 return price.active&&price.currency==='usd'&&price.billing_scheme==='tiered'&&price.tiers_mode==='graduated'&&price.recurring?.interval==='month'&&price.recurring.interval_count===1&&price.recurring.usage_type==='licensed'&&tiers?.length===2&&tiers[0].up_to===product.serverLimit&&tiers[0].flat_amount===product.monthlyPrice*100&&(tiers[0].unit_amount??0)===0&&tiers[1].up_to===null&&(tiers[1].flat_amount??0)===0&&tiers[1].unit_amount===(product.extraDeviceMonthlyPrice??0)*100;
}

// Shared by checkout and worker: serialize financial changes across replicas.
export async function withBillingLock<T>(org:string,work:()=>Promise<T>):Promise<T|null>{
 const owner=randomUUID(),key={pk:'ORG#'+org,sk:'BILLING_LOCK'},now=Date.now();
 if(table){try{await db.send(new PutCommand({TableName:table,Item:{...key,owner,expiresAt:now+180000,ttl:Math.floor(now/1000)+3600},ConditionExpression:'attribute_not_exists(pk) OR expiresAt<:now',ExpressionAttributeValues:{':now':now}}));}catch(error){if(error instanceof Error&&error.name==='ConditionalCheckFailedException')return null;throw error;}}
 else{if(locks.has(org))return null;locks.add(org);}
 try{return await work();}finally{
  if(table)await db.send(new DeleteCommand({TableName:table,Key:key,ConditionExpression:'#owner=:owner',ExpressionAttributeNames:{'#owner':'owner'},ExpressionAttributeValues:{':owner':owner}})).catch(error=>{if(!(error instanceof Error&&error.name==='ConditionalCheckFailedException'))throw error;});
  else locks.delete(org);
 }
}

// Only newly consented subscriptions use automatic quantity billing. Never migrate legacy subscriptions silently.
export async function reconcileDeviceBilling(org:string,client?:Stripe){
 if(process.env.SMARTDETECTOR_DEPLOYMENT_MODE!=='saas')return;
 return withBillingLock(org,async()=>{
  const local=await store.activeSubscriptionForOrg(org);
  if(!local?.stripeSubscriptionId)return;
  client??=stripe();
  const subscription=await client.subscriptions.retrieve(local.stripeSubscriptionId,{expand:['items.data.price.tiers']});
  if(!['active','trialing'].includes(subscription.status)||subscription.metadata.orgId!==org||subscription.metadata.deviceBillingTerms!==DEVICE_BILLING_TERMS)return;
  if(subscription.items.data.length!==1)return;
  const item=subscription.items.data[0];
  const product=(await store.products()).find(product=>product.monthlyPrice>0&&product.stripePriceId===item.price.id);
  if(!product)throw Error('Device billing price does not match the configured plan');
  if(item.price.id!==product.stripePriceId||!matchesDevicePrice(item.price,product))throw Error('Device billing price does not match the configured plan');
  const quantity=deviceQuantity(await store.nodes(org));
  if(item.quantity===quantity)return;
  const revision=Number(subscription.metadata.deviceBillingRevision??'0');
  if(!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid device billing revision');
  await client.subscriptions.update(subscription.id,{items:[{id:item.id,quantity}],proration_behavior:'create_prorations',metadata:{deviceBillingRevision:String(revision+1)}},{idempotencyKey:`devices-v2:${subscription.id}:${revision}:${quantity}`});
 });
}
