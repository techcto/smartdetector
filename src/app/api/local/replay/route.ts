import {NextRequest,NextResponse} from 'next/server';
import {operator} from '@/lib/operator';
import {requestOrigin} from '@/lib/session';
import {claimLocalReplay,localReplayEnabled,replayCamera,replaySamples,replayCameraIdentity} from '@/lib/local-replay';
import {readBody} from '@/lib/read-body';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!localReplayEnabled())return NextResponse.json({error:'Not found'},{status:404});
 const origin=requestOrigin(req);
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)||req.headers.get('origin')!==origin)return NextResponse.json({error:'Local same-origin request required'},{status:403});
 const session=await operator(req);if(session?.role!=='root')return NextResponse.json({error:'Root administrator required'},{status:403});
 try{
  const {sample,mode='recorded',camera}=JSON.parse(await readBody(req,256));
  if(camera!==undefined)replayCameraIdentity(camera);
  if(!replaySamples.includes(sample)||!['recorded','live'].includes(mode))return NextResponse.json({error:'Choose a supported sample and recorded/live mode'},{status:400});
  if(!claimLocalReplay(session.orgId))return NextResponse.json({error:'Wait three seconds between replays'},{status:429});
  return NextResponse.json(await replayCamera(session.orgId,sample,mode,camera),{status:201,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Replay failed. Check sample integrity and, for live mode, the AutoVision service configuration.'},{status:400})}
}
