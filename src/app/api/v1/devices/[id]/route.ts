import { NextRequest, NextResponse } from 'next/server';
import { readIdentity } from '@/lib/api-keys';
import { store } from '@/lib/store';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {disconnectTv} from '@/lib/tv';
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const identity = await readIdentity(req, 'devices:read');
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 });
  const v = await store.node(identity.orgId, id);
  const session=await operator(req);
  return v ? NextResponse.json({ serverId: v.serverId, displayName: v.displayName, platform: v.platform, providerKey:v.providerKey,connectionId:v.connectionId,modelId:v.modelId, tags: v.tags, status: v.status, createdAt: v.createdAt, lastHeartbeat: v.lastHeartbeat,canRemove:!!session&&session.orgId===identity.orgId&&['root','admin'].includes(session.role) }, { headers: { 'cache-control': 'no-store' } }) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
export async function DELETE(req:NextRequest,context:{params:Promise<{id:string}>}){
 const session=await operator(req);if(!session||!['root','admin'].includes(session.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
 const {id}=await context.params;if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id))return NextResponse.json({error:'Invalid device ID'},{status:400});
 try{const body=JSON.parse(await readBody(req,1024));if(body.confirmation!=='DELETE'||body.deviceId!==id)return NextResponse.json({error:'Exact device confirmation required'},{status:400});const device=await store.node(session.orgId,id);if(!device)return NextResponse.json({error:'Device not found in this location'},{status:404});if(device.providerKey==='firetv'&&device.connectionId)await disconnectTv(session.orgId,device.connectionId);return NextResponse.json({removed:true,...await store.removeDevice(session.orgId,id)},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Unable to finish removal. Retry to complete cleanup.'},{status:503})}
}
