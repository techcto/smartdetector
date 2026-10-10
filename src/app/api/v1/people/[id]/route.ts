import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {personTimeline,removePerson,tagPersonEvent,enrollmentCandidates,enrollPerson,person} from '@/lib/people';
type Context={params:Promise<{id:string}>};
const headers={'Cache-Control':'no-store'};
export async function GET(req:NextRequest,context:Context){const user=await operator(req);if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const value=await personTimeline(user.orgId,(await context.params).id);return NextResponse.json(value??{error:'Person not found'},{status:value?200:404,headers});}
export async function POST(req:NextRequest,context:Context){
 const user=await operator(req);if(!user||!['root','admin'].includes(user.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'Forbidden'},{status:403});
 try{
  const body=JSON.parse(await readBody(req,2048)),id=(await context.params).id;
  if(!body||typeof body.eventId!=='string'||body.eventId.length>100)throw Error('Invalid event');
  if(body.action==='inspect'){
   if(!await person(user.orgId,id))return NextResponse.json({error:'Person not found'},{status:404,headers});
   return NextResponse.json(await enrollmentCandidates(user.orgId,id,body.eventId,body.frameIndex),{headers});
  }
  if(body.action==='enroll')return NextResponse.json({person:await enrollPerson(user.orgId,id,body.eventId,body.frameIndex,body.faceIndex,body.consent,body.proof)},{headers});
  if(Object.keys(body).some(k=>k!=='eventId'))throw Error('Invalid action');
  await tagPersonEvent(user.orgId,id,body.eventId);return NextResponse.json({saved:true},{headers});
 }catch{return NextResponse.json({error:'Unable to complete. Select a retained frame and consenting face; AutoVision face models must be configured. Manual assignment requires activity saving.'},{status:400,headers});}
}
export async function DELETE(req:NextRequest,context:Context){const user=await operator(req);if(!user||!['root','admin'].includes(user.role)||req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'Forbidden'},{status:403});try{const body=JSON.parse(await readBody(req,1024));if(body.confirmation!=='DELETE PERSON')throw Error();const removed=await removePerson(user.orgId,(await context.params).id);return NextResponse.json({removed},{status:removed?200:404,headers});}catch{return NextResponse.json({error:'Confirm DELETE PERSON'},{status:400,headers});}}
