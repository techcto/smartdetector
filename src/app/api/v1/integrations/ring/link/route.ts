import {syncRingCameras} from '@/lib/device-connect';
import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {completeRingLink} from '@/lib/ring-link';
export async function POST(req:NextRequest){
 const s=await operator(req);if(!s||!['root','admin'].includes(s.role))return NextResponse.json({error:'Sign in as a location administrator to link Ring.'},{status:403});
 if(req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'Cross-origin account linking is not allowed'},{status:403});
 try{const v=JSON.parse(await readBody(req,4096));if(v.orgId!==s.orgId||typeof v.connectionId!=='string'||typeof v.nonce!=='string'||typeof v.time!=='string')return NextResponse.json({error:'Select the matching location before linking.'},{status:403});await completeRingLink(s.orgId,v.connectionId,s.id,v.nonce,v.time);let discoveryPending=false;try{await syncRingCameras(s.orgId,v.connectionId)}catch{discoveryPending=true}return NextResponse.json({linked:true,discoveryPending},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Ring link could not be completed. Check the location, staging credentials, and start a fresh link from Ring.'},{status:400})}
}
