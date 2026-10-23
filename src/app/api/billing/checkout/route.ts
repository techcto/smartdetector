import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {store} from '@/lib/store';
import {stripe} from '@/lib/stripe';
import {browserOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {DEVICE_BILLING_TERMS,deviceQuantity,matchesDevicePrice,withBillingLock} from '@/lib/device-billing';
import {checkoutForWorkspace,CheckoutPending} from '@/lib/billing-checkout';

export async function POST(req:NextRequest){
 const session=await operator(req);
 if(!session||!['root','admin'].includes(session.role))return NextResponse.json({error:'forbidden'},{status:403});
 if(process.env.SMARTDETECTOR_DEPLOYMENT_MODE!=='saas')return NextResponse.json({error:'Billing is disabled for private installs'},{status:409});
 const origin=browserOrigin(req);
 if(req.headers.get('origin')!==origin)return NextResponse.json({error:'forbidden'},{status:403});
 let input:{productId?:string;acceptDeviceBilling?:boolean};
 try{input=JSON.parse(await readBody(req,2048));if(!input||typeof input!=='object')throw Error('Invalid request');}catch{return NextResponse.json({error:'Invalid checkout request'},{status:400});}
 if(input.acceptDeviceBilling!==true)return NextResponse.json({error:'Accept the automatic additional-device billing terms before checkout'},{status:400});
 const product=(await store.products()).find(product=>product.id===input.productId&&product.active&&product.monthlyPrice>0);
 if(!product)return NextResponse.json({error:'Unknown paid plan'},{status:400});
 if(!product.stripePriceId||!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:'Billing is not configured'},{status:503});
 try{
  const result=await withBillingLock(session.orgId,async()=>{
   if((await store.subscriptions(session.orgId)).some(subscription=>subscription.stripeSubscriptionId&&subscription.status!=='canceled'))return NextResponse.json({error:'Manage your existing subscription before starting another plan'},{status:409});
   const client=stripe(),price=await client.prices.retrieve(product.stripePriceId,{expand:['tiers']});
   if(!matchesDevicePrice(price,product))return NextResponse.json({error:'Stripe pricing has not been updated for this plan. Please contact support.'},{status:503});
   const quantity=deviceQuantity(await store.nodes(session.orgId));
   const metadata={orgId:session.orgId,productId:product.id,deviceBillingTerms:DEVICE_BILLING_TERMS,deviceBillingRevision:'0'};
   const checkout=await checkoutForWorkspace(session.orgId,{mode:'subscription',allow_promotion_codes:true,line_items:[{price:product.stripePriceId,quantity}],metadata,managed_payments:{enabled:false},subscription_data:{metadata},custom_text:{submit:{message:`${product.serverLimit} devices included at $${product.monthlyPrice}/month. Additional registered devices cost $2/device/month, prorated on your next invoice. Offline devices count until removed.`}},success_url:origin+'/settings/billing?checkout=success',cancel_url:origin+'/settings/billing?checkout=canceled'},client);
   return NextResponse.json({url:checkout.url});
  });
  return result??NextResponse.json({error:'Billing is busy. Please retry.'},{status:409});
 }catch(error){return NextResponse.json({error:error instanceof CheckoutPending?error.message:'Unable to start checkout. Please try again.'},{status:error instanceof CheckoutPending?409:503});}
}
