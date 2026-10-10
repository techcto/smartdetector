import {NextRequest,NextResponse} from 'next/server';
import {receiveRingCode} from '@/lib/ring-link';
import {readBody} from '@/lib/read-body';
export async function POST(req:NextRequest,{params}:{params:Promise<{orgId:string;connectionId:string}>}){
 const {orgId,connectionId}=await params;
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(orgId)||!/^[a-zA-Z0-9_-]{1,100}$/.test(connectionId))return NextResponse.json({error:'Invalid connection'},{status:400});
 try{const raw=await readBody(req,16384);const input=req.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));return NextResponse.json(await receiveRingCode(orgId,connectionId,input.code),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Unable to exchange Ring code. Check staging app credentials and retry linking.'},{status:400})}
}
