import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {providers,listSettings,publicSetting,saveSetting,removeSetting,setting} from '@/lib/providers';
import {disconnectTv} from '@/lib/tv';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
export async function GET(req:NextRequest){const s=await operator(req);if(!s)return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.json({providers,connections:(await listSettings(s.orgId)).filter(v=>providers.some(p=>p.key===v.providerKey)).map(publicSetting)})}
export async function POST(req:NextRequest){const s=await operator(req);if(!s||s.role!=='root'||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});try{const input=JSON.parse(await readBody(req,16384));if(input.providerKey==='firetv')return NextResponse.json({error:'Fire TV connections are created by approving a display pairing code. Disconnect and pair again to change the connection.'},{status:409});return NextResponse.json(publicSetting(await saveSetting(s.orgId,s.id,input)))}catch{return NextResponse.json({error:'Invalid provider connection'},{status:400})}}
export async function DELETE(req:NextRequest){const s=await operator(req);if(!s||!['root','admin'].includes(s.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'forbidden'},{status:403});try{const{id}=JSON.parse(await readBody(req,1024));if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))return NextResponse.json({error:'Invalid connection ID'},{status:400});const c=await setting(s.orgId,id);if(!c)return NextResponse.json({error:'Connection not found'},{status:404});return NextResponse.json({deleted:c.providerKey==='firetv'?await disconnectTv(s.orgId,id):await removeSetting(s.orgId,id)})}catch{return NextResponse.json({error:'Unable to disconnect connection'},{status:503})}}

