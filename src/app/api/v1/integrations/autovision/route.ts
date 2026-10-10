import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {visionConfig,saveVisionConfig} from '@/lib/system-vision';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
export async function GET(req:NextRequest){const s=await operator(req);if(s?.role!=='root')return NextResponse.json({error:'forbidden'},{status:403});const v=await visionConfig();return NextResponse.json({configured:!!v.apiKey,url:v.url,managedBy:v.managedBy,persistent:!!process.env.SMARTDETECTOR_TABLE},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){const s=await operator(req);if(s?.role!=='root'||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});try{const v=JSON.parse(await readBody(req,8192));if(typeof v.url!=='string'||typeof v.apiKey!=='string')throw Error();await saveVisionConfig(v.url,v.apiKey);return NextResponse.json({saved:true},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Unable to save. Use a valid service origin and API key; leave a saved key blank to keep it.'},{status:400})}}

