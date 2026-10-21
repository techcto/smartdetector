import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin,verifyToken} from '@/lib/session';
import {playgroundEnabled,activePlayground} from '@/lib/ring-playground';
import {store} from '@/lib/store';
import {readBody} from '@/lib/read-body';
import {analyzeFrames} from '@/lib/vision-analysis';
type Ticket={orgId:string;deviceId:string;purpose:string;displayId?:string;expiresAt:number};
async function access(req:NextRequest){
 if(!playgroundEnabled())return null;
 const origin=requestOrigin(req);
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))return null;
 const s=await operator(req);return s?.role==='root'?s:null;
}
export async function GET(req:NextRequest){
 const s=await access(req);if(!s)return NextResponse.json({error:'Not available'},{status:404});
 const d=await store.node(s.orgId,req.nextUrl.searchParams.get('deviceId')??'');
 const row=await activePlayground(s.orgId,d?.connectionId);
 if(!d||d.providerKey!=='ring'||d.connectionId!=='playground-local'||!row)return NextResponse.json({error:'Not available'},{status:404});
 return NextResponse.json({enabled:true},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
 const s=await access(req);if(!s||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'Not available'},{status:404});
 try{
  const v=JSON.parse(await readBody(req,2000000));
  const d=typeof v.deviceId==='string'?await store.node(s.orgId,v.deviceId):null;
  const row=await activePlayground(s.orgId,d?.connectionId);
  if(!d||d.providerKey!=='ring'||d.connectionId!=='playground-local'||!row)return NextResponse.json({error:'Active Playground camera required'},{status:403});
  const ticket=await verifyToken<Ticket>(v.ticket,process.env.SMARTDETECTOR_SESSION_SECRET??'');
  if(!ticket||ticket.purpose!=='ring-live'||ticket.orgId!==s.orgId||ticket.deviceId!==d.serverId||ticket.displayId)return NextResponse.json({error:'Start this Playground camera live view first'},{status:403});
  if(!Array.isArray(v.frames)||v.frames.length!==8||v.frames.some((f:{image?:unknown;at_ms?:unknown},i:number)=>typeof f?.image!=='string'||f.image.length>240000||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(f.image)||f.at_ms!==i*1000))return NextResponse.json({error:'Eight bounded JPEG frames at one-second offsets (0–7000ms) required'},{status:400});
  const result=await analyzeFrames(s.orgId,d.serverId,v.frames,true,'ring-playground');
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Playground analysis failed. Confirm the token is active, video is playing and AutoVision is configured; no synthetic result was saved.'},{status:503});}
}
