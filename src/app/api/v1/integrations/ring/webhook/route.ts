import {NextRequest,NextResponse} from 'next/server';
import {systemIntegration} from '@/lib/system-integrations';
import {ringDestination} from '@/lib/ring-link';
import {connectionCredentials} from '@/lib/providers';
import {verifyRingSignature,parseRingEvent} from '@/lib/ring';
import {queueRingEvent} from '@/lib/ring-jobs';
import {readBody} from '@/lib/read-body';
export async function POST(req:NextRequest){
 try{
  const config=await systemIntegration('ring'),raw=await readBody(req,65536);
  if(!config.hmacKey||!verifyRingSignature(raw,req.headers.get('x-signature')??'',config.hmacKey))return NextResponse.json({error:'unauthorized'},{status:401});
  let event;try{event=parseRingEvent(raw)}catch{return NextResponse.json({error:'Invalid Ring event'},{status:400})}
  const destination=await ringDestination(event.accountId);
  if(!destination)return NextResponse.json({error:'Account not linked'},{status:403});
  const linked=await connectionCredentials(destination.orgId,destination.connectionId,'ring');
  if(!linked?.accessToken||linked.accountId!==event.accountId)return NextResponse.json({error:'Account disconnected'},{status:403});
  const jobId=await queueRingEvent(destination.orgId,destination.connectionId,event);
  return NextResponse.json({accepted:true,jobId});
 }catch{return NextResponse.json({error:'Delivery unavailable; retry'},{status:503})}
}
