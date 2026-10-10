import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {listSettings} from '@/lib/providers';
import {syncRingCameras} from '@/lib/device-connect';
export async function POST(req:NextRequest){
 const s=await operator(req);
 if(!s||!['root','admin'].includes(s.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
 const linked=(await listSettings(s.orgId)).filter(c=>c.providerKey==='ring'&&c.enabled&&c.settings.accessToken);
 if(!linked.length)return NextResponse.json({error:'Link a Ring account first'},{status:409});
 try{let count=0;for(const c of linked)count+=await syncRingCameras(s.orgId,c.id);return NextResponse.json({connected:count});}
 catch{return NextResponse.json({error:'Camera sync failed. Existing devices were preserved; retry discovery.'},{status:503});}
}
