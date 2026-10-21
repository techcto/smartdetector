import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {playgroundEnabled,activePlayground,savePlaygroundToken,removePlaygroundToken} from '@/lib/ring-playground';
import {syncRingCameras} from '@/lib/device-connect';
import {store} from '@/lib/store';
export const dynamic='force-dynamic';
async function allowed(req:NextRequest,mutation=false){
 if(!playgroundEnabled())return false;
 const origin=requestOrigin(req);
 return ['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)&&(!mutation||req.headers.get('origin')===origin)&&(await operator(req))?.role==='root';
}
export async function GET(req:NextRequest){
 if(!await allowed(req))return NextResponse.json({error:'Not available'},{status:404});
 const row=await activePlayground((await operator(req))!.orgId);
 return NextResponse.json({enabled:true,connected:!!row,expiresAt:row?.expiresAt??null},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
 if(!await allowed(req,true))return NextResponse.json({error:'Not available'},{status:404});
 const session=(await operator(req))!;
 let id:string|undefined;
 try{
  const value=JSON.parse(await readBody(req,17000));if(typeof value.token!=='string')throw Error();
  const saved=await savePlaygroundToken(session.orgId,value.token.trim());id=saved.id;
  const count=await syncRingCameras(session.orgId,id);await store.expirePlayground(session.orgId);
  return NextResponse.json({connected:true,cameras:count,expiresAt:saved.expiresAt},{headers:{'Cache-Control':'no-store'}});
 }catch{if(id)await removePlaygroundToken(session.orgId,id);return NextResponse.json({error:'Unable to connect. Generate a fresh Playground token and confirm Device List works in Ring. No token is returned or logged.'},{status:400});}
}
export async function DELETE(req:NextRequest){
 if(!await allowed(req,true))return NextResponse.json({error:'Not available'},{status:404});
 const org=(await operator(req))!.orgId,row=await activePlayground(org);if(row)await removePlaygroundToken(org,row.id);
 await store.expirePlayground(org);return NextResponse.json({disconnected:true},{headers:{'Cache-Control':'no-store'}});
}
