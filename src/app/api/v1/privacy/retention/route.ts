import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {store} from '@/lib/store';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
export async function GET(req:NextRequest){
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role))return NextResponse.json({error:'forbidden'},{status:403});
 return NextResponse.json(await store.imageRetention(s.orgId),{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(req:NextRequest){
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
 let days:number;try{const value=JSON.parse(await readBody(req,256));days=value.days;if(Object.keys(value).some(k=>k!=='days')||!Number.isInteger(days)||days<1||days>365)throw Error();}catch{return NextResponse.json({error:'Choose 1–365 days'},{status:400});}
 if(days>1&&!(await store.imageRetention(s.orgId)).paid)return NextResponse.json({error:'An active paid subscription is required for longer retention'},{status:403});
 const current=await store.settings(s.orgId);await store.putSettings(s.orgId,{...current,privacy:{...current.privacy,imageRetentionDays:days},updatedAt:new Date().toISOString()});
 if(days<(current.privacy.imageRetentionDays??1)){
  try{await store.expireEvidence(s.orgId);}catch{return NextResponse.json({error:'Retention saved; cleanup is pending and the worker will retry. Expired evidence is already unavailable.'},{status:503});}
 }
 return NextResponse.json({saved:true,...await store.imageRetention(s.orgId)},{headers:{'Cache-Control':'no-store'}});
}
