import {NextRequest,NextResponse} from 'next/server';
import {receiveRingCode} from '@/lib/ring-link';
import {readBody} from '@/lib/read-body';
export async function POST(req:NextRequest){
 try{const raw=await readBody(req,16384);const input=req.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));return NextResponse.json(await receiveRingCode('SYSTEM','APP',input.code),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Unable to exchange Ring code. Check system app credentials and start a fresh link.'},{status:400})}
}
