import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {integrationFields,publicSystemIntegration,saveSystemIntegration,SystemIntegration} from '@/lib/system-integrations';
type Context={params:Promise<{provider:string}>};
export async function GET(req:NextRequest,context:Context){
 if((await operator(req))?.role!=='root')return NextResponse.json({error:'forbidden'},{status:403});
 const {provider}=await context.params;if(!Object.hasOwn(integrationFields,provider))return NextResponse.json({error:'Unknown integration'},{status:404});
 return NextResponse.json({settings:await publicSystemIntegration(provider as SystemIntegration),persistent:!!process.env.SMARTDETECTOR_TABLE},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest,context:Context){
 if((await operator(req))?.role!=='root'||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});
 const {provider}=await context.params;if(!Object.hasOwn(integrationFields,provider))return NextResponse.json({error:'Unknown integration'},{status:404});
 try{await saveSystemIntegration(provider as SystemIntegration,JSON.parse(await readBody(req,16384)));return NextResponse.json({saved:true},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Unable to save. Check the fields; Ring requires all three credentials. Blank fields keep saved values.'},{status:400})}
}
