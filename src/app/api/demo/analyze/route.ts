import {analyzeDemo,DemoError} from '@/lib/public-demo';
import {readBody} from '@/lib/read-body';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');
  // Host preserves the browser-facing port behind local Docker/NAT. Never trust an arbitrary forwarded host.
  let sameOrigin=false;try{const parsed=new URL(origin??'');sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===(request.headers.get('host')??new URL(request.url).host)&&parsed.origin===origin}catch{}
  if(!sameOrigin)return Response.json({error:'Cross-origin demo is not allowed'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Use application/json'},{status:415});
  let input;try{input=JSON.parse(await readBody(request,256))}catch{return Response.json({error:'Invalid demo request'},{status:400})}
  return Response.json({...await analyzeDemo(input.scenario),notification_mode:'preview_only'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof DemoError?e.message:'AutoVision is temporarily unavailable'},{status:e instanceof DemoError?e.status:503})}
}
