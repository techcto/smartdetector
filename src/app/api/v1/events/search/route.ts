import {NextRequest,NextResponse} from 'next/server';
import {readIdentity} from '@/lib/api-keys';
import {authorizeTv} from '@/lib/tv';
import {requestOrigin} from '@/lib/session';
import {readBody} from '@/lib/read-body';
import {store} from '@/lib/store';
import {planEventSearch,matchEventSearch,validTimeZone,SearchInputError} from '@/lib/event-search';
import {eventView} from '@/lib/event-view';
export async function POST(req:NextRequest){
 const bearer=req.headers.get('authorization');
 const tv=bearer?.startsWith('Bearer ')?await authorizeTv(bearer.slice(7)):null;
 const identity=tv??await readIdentity(req,'events:read');
 if(!identity)return NextResponse.json({error:'Search access expired or revoked'},{status:401});
 if((!bearer||req.headers.has('origin'))&&req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'Cross-origin search is not allowed'},{status:403});
 try{
  const input=JSON.parse(await readBody(req,2048));if(typeof input?.query!=='string'||!input.query.trim()||input.query.length>400)throw new SearchInputError('Enter a search of 1–400 characters');
  const timeZone=validTimeZone(input.timeZone??'UTC'),devices=(await store.nodes(identity.orgId)).filter(d=>d.providerKey!=='firetv'&&d.platform!=='firetv');
  if(input.deviceId!==undefined&&(typeof input.deviceId!=='string'||!devices.some(d=>d.serverId===input.deviceId)))return NextResponse.json({error:'Device unavailable in this location'},{status:404});
  const plan=planEventSearch(input.query,devices);if(input.deviceId){if(plan.deviceIds.length&&!plan.deviceIds.includes(input.deviceId))throw new SearchInputError('Search camera conflicts with the selected device');plan.deviceIds=[input.deviceId];}
  const history=await store.searchableIncidents(identity.orgId),matches=matchEventSearch(history.rows,plan,timeZone);
  return NextResponse.json({query:input.query,plan,timeZone,matched:matches.length,evaluated:history.rows.length,truncated:history.truncated||matches.length>50,items:matches.slice(0,50).map(i=>{const p=eventView(i.payload);return {id:i.incidentId,deviceId:i.serverId,state:i.state,at:i.startedAt,source:p.source,thumbnail:p.preview,frames:p.evidenceFrames,summary:p.aiSummary||p.assessment||p.kind}})},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof SyntaxError?'Invalid search request':e instanceof SearchInputError?e.message:'Search unavailable; please retry'},{status:e instanceof SyntaxError||e instanceof SearchInputError?400:503})}
}
