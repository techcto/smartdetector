import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {store} from '@/lib/store';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
export async function GET(req:NextRequest){
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role))return NextResponse.json({error:'forbidden'},{status:403});
 return NextResponse.json({enabled:(await store.settings(s.orgId)).privacy.enhancedInspection===true},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(req:NextRequest){
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
 let enabled:boolean;try{const value=JSON.parse(await readBody(req,256));enabled=value.enabled;if(Object.keys(value).some(k=>k!=='enabled')||typeof enabled!=='boolean')throw Error();}catch{return NextResponse.json({error:'Choose enabled true or false'},{status:400});}
 const current=await store.settings(s.orgId);await store.putSettings(s.orgId,{...current,privacy:{...current.privacy,enhancedInspection:enabled},updatedAt:new Date().toISOString()});
 return NextResponse.json({saved:true,enabled},{headers:{'Cache-Control':'no-store'}});
}
