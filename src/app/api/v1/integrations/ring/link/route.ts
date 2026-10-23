import {syncRingCameras} from '@/lib/device-connect';
import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {completeRingLink,completeSystemRingLink} from '@/lib/ring-link';
export async function POST(req:NextRequest){
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role))return NextResponse.json({error:'Sign in as a location administrator to link Ring.'},{status:403});
 if(req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'Cross-origin account linking is not allowed'},{status:403});
 try{const v=JSON.parse(await readBody(req,4096));if(typeof v.nonce!=='string'||typeof v.time!=='string')throw Error('Missing link parameters');let id:string;
 if(!v.orgId&&!v.connectionId)id=await completeSystemRingLink(s.orgId,s.id,v.nonce,v.time);
 else{if(v.orgId!==s.orgId||typeof v.connectionId!=='string')return NextResponse.json({error:'Select the matching location before linking.'},{status:403});id=v.connectionId;await completeRingLink(s.orgId,id,s.id,v.nonce,v.time)}
 let discoveryPending=false;try{await syncRingCameras(s.orgId,id,fetch,true)}catch{discoveryPending=true}return NextResponse.json({linked:true,discoveryPending},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Ring link could not be completed. Check the location, app credentials, and start a fresh link from Ring.'},{status:400})}
}
