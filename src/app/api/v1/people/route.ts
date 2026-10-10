import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {listPeople,savePerson} from '@/lib/people';
const headers={'Cache-Control':'no-store'};
export async function GET(req:NextRequest){const user=await operator(req);if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json({people:await listPeople(user.orgId),canManage:user.role==='root'||user.role==='admin',recognitionStatus:'requires-configured-autovision-models'},{headers});}
export async function POST(req:NextRequest){const user=await operator(req);if(!user||!['root','admin'].includes(user.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'Forbidden'},{status:403});try{return NextResponse.json({person:await savePerson(user.orgId,JSON.parse(await readBody(req,2048)))},{headers});}catch{return NextResponse.json({error:'Check the name and preferences; person must belong to this location.'},{status:400,headers});}}
