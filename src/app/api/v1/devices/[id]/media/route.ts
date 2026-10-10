import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {store} from '@/lib/store';
import {ringAccess} from '@/lib/ring-link';
import {RingClient} from '@/lib/ring';
import {requestOrigin,signToken,verifyToken} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {authorizeTv} from '@/lib/tv';
type Ticket={orgId:string;deviceId:string;sessionId:string;expiresAt:number;purpose:'ring-live';displayId?:string};
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const bearer=req.headers.get('authorization');
 const tv=bearer?await authorizeTv(bearer.replace(/^Bearer /,'')):null;
 const s=tv?{orgId:tv.orgId,role:'display'}:await operator(req);
 if(!s||s.role==='viewer'||(bearer&&!tv)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
 const {id}=await params;const d=await store.node(s.orgId,id);
 if(!d||d.providerKey!=='ring'||!d.connectionId||!d.externalId)return NextResponse.json({error:'Camera not found in this location'},{status:404});
 try{
  const v=JSON.parse(await readBody(req,131072)),config=await ringAccess(s.orgId,d.connectionId),base='https://api.amazonvision.com/v1/devices/'+encodeURIComponent(d.externalId)+'/media/streaming/whep/sessions',secret=process.env.SMARTDETECTOR_SESSION_SECRET??'';
  if(v.action==='snapshot'){if(tv)return NextResponse.json({error:'Display access is for live viewing only'},{status:403});const image=await new RingClient(config.accessToken).snapshot(d.externalId,Date.now(),undefined,true);return NextResponse.json({image:'data:image/jpeg;base64,'+image,retrievedAt:new Date().toISOString(),label:'Latest available image within 24 hours; not live'},{headers:{'Cache-Control':'no-store'}});}
  if(v.action==='stop'){
   const t=await verifyToken<Ticket>(v.ticket,secret);if(!t||t.purpose!=='ring-live'||t.orgId!==s.orgId||t.deviceId!==id||t.displayId!==tv?.connectionId||!/^[a-zA-Z0-9_.:-]{1,256}$/.test(t.sessionId))return NextResponse.json({error:'Invalid live session'},{status:403});
   const r=await fetch(base+'/'+encodeURIComponent(t.sessionId),{method:'DELETE',headers:{Authorization:'Bearer '+config.accessToken},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok&&r.status!==404)throw Error('Unable to stop stream');return NextResponse.json({stopped:true});
  }
  if(v.action!=='live'||typeof v.sdp!=='string'||!v.sdp.startsWith('v=0')||v.sdp.length>100000)return NextResponse.json({error:'Invalid stream offer'},{status:400});
  const r=await fetch(base,{method:'POST',headers:{Authorization:'Bearer '+config.accessToken,'Content-Type':'application/sdp'},body:v.sdp,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(r.status!==201)throw Error('Live session unavailable (HTTP '+r.status+')');
  const url=new URL(r.headers.get('location')??'',base),prefix=new URL(base).pathname+'/';const sessionId=url.pathname.slice(prefix.length);
  if(url.origin!=='https://api.amazonvision.com'||!url.pathname.startsWith(prefix)||!/^[a-zA-Z0-9_.:-]{1,256}$/.test(sessionId))throw Error('Invalid session URL');
  const answer=await r.text();if(answer.length>100000||!answer.startsWith('v=0'))throw Error('Invalid stream answer');
  const ticket=await signToken<Ticket>({orgId:s.orgId,deviceId:id,sessionId,purpose:'ring-live',displayId:tv?.connectionId,expiresAt:Date.now()+300000},secret);
  return NextResponse.json({sdp:answer,ticket,maxSeconds:30},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Ring media unavailable. Check camera connectivity, granted media permissions, and available recordings. No snapshot is guaranteed before new activity.'},{status:503});}
}
