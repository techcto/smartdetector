import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NextRequest} from 'next/server';
import {analyzeFrames} from '../src/lib/vision-analysis';
import {eventView,inspectionSummary} from '../src/lib/event-view';
import {store} from '../src/lib/store';
import {issueTvAccess} from '../src/lib/tv';
import {GET as tvFeed} from '../src/app/api/v1/tv/feed/route';
import {GET,PUT} from '../src/app/api/v1/privacy/inspection/route';
import {createSession,sessionCookie} from '../src/lib/session';
const report=JSON.parse(readFileSync('public/demo/backyardintruder-analysis.json','utf8'));
const frames=report.frames.slice(0,2).map((f:{at_ms:number;preview:string})=>({at_ms:f.at_ms,image:f.preview}));
// Shape of AutoVision's enhanced inspection (see autovision devops/testing/autonomous-inspection-live.json), with a bulky tool output.
const inspection={status:'complete',review_recommended:true,reason:'Person near the back door at night.',model:'us.amazon.nova-lite-v1:0',followup_count:2,images_sent_to_bedrock:true,trace:[
 {step:0,tool:'inspect_region',status:'complete',duration_ms:910,input:{frame_index:0,box:{x:0.4,y:0.2,width:0.1,height:0.4},padding:0.15},output:{operation:'inspect_region',result:{frames:[{preview:'A'.repeat(50000)}]}}},
 {step:1,tool:'assess_scene',status:'complete',duration_ms:1858,input:{frame_index:0,focus:'scene'},output:{focus:'scene'}},
 {step:2,tool:'finish',status:'complete',duration_ms:961,reason:'Evidence is sufficient for human review.'},
]};
function autoVision(bodies:unknown[]):typeof fetch{
 return async(_url,init)=>{const body=JSON.parse(String(init?.body));bodies.push(body);return Response.json({job_id:'job-'+bodies.length,observations:[{type:'person',value:0,detected:false}],frames:[],classification:{status:'complete',summary:'Scene reviewed.'},privacy:{sent_to_bedrock:body.enhanced===true},inspection:body.enhanced?inspection:{status:'not_requested',review_recommended:false,reason:'Enhanced inspection disabled.',trace:[],followup_count:0,images_sent_to_bedrock:false}});};
}
test('enhanced inspection is a workspace opt-in that only rides on classify consent',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-enhanced-session-secret-long-enough';
 const previous=process.env.SMARTDETECTOR_AUTOVISION_API_KEY;process.env.SMARTDETECTOR_AUTOVISION_API_KEY='synthetic-service-key';
 try{
  const org=await store.createOrganization({name:'Enhanced',ownerId:'root',orgType:'personal'}),bodies:{enhanced:boolean;classify:boolean}[]=[];
  const off=await analyzeFrames(org.id,'camera',frames,true,'ring','off',autoVision(bodies));
  assert.equal(bodies[0].enhanced,false);// Explicit false overrides AutoVision's own account default.
  assert.equal(eventView((await store.incident(org.id,off.incidentId))!.payload).inspection,null);
  const settings=await store.settings(org.id);await store.putSettings(org.id,{...settings,privacy:{...settings.privacy,enhancedInspection:true}});
  await analyzeFrames(org.id,'camera',frames,false,'ring','no-consent',autoVision(bodies));assert.equal(bodies[1].enhanced,false);
  const on=await analyzeFrames(org.id,'camera',frames,true,'ring','on',autoVision(bodies));assert.equal(bodies[2].enhanced,true);
  const row=(await store.incident(org.id,on.incidentId))!,stored=(row.payload as {inspection:typeof inspection}).inspection;
  assert.ok(!JSON.stringify(stored).includes('AAAA'));assert.ok(stored.trace.every(t=>!('input' in t)&&!('output' in t)));
  const view=eventView(row.payload);
  assert.equal(view.inspection?.review_recommended,true);assert.equal(view.inspection?.followup_count,2);assert.deepEqual(view.inspection?.trace.map(t=>t.tool),['inspect_region','assess_scene','finish']);assert.equal(view.sentToBedrock,true);
  const display=await issueTvAccess(org.id,'root','Enhanced TV');
  const feed=await(await tvFeed(new NextRequest('http://localhost/api/v1/tv/feed',{headers:{authorization:'Bearer '+display.token}}))).json();
  assert.equal(feed.incidents.find((i:{id:string})=>i.id===on.incidentId).review,true);assert.equal(feed.incidents.find((i:{id:string})=>i.id===off.incidentId).review,false);
 }finally{if(previous===undefined)delete process.env.SMARTDETECTOR_AUTOVISION_API_KEY;else process.env.SMARTDETECTOR_AUTOVISION_API_KEY=previous;}
});
test('inspection summary is bounded, idempotent and rejects unknown statuses',()=>{
 const summary=inspectionSummary({...inspection,reason:'x'.repeat(900),followup_count:9,trace:[...inspection.trace,{tool:'<script>',status:'complete'}]})!;
 assert.equal(summary.reason.length,500);assert.equal(summary.followup_count,2);assert.equal(summary.trace.length,3);
 assert.deepEqual(inspectionSummary(summary),summary);
 assert.equal(inspectionSummary({...inspection,status:'hacked'}),null);assert.equal(inspectionSummary(undefined),null);
});
test('inspection setting requires an administrator, same origin and a boolean',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-inspection-session-secret-long-enough';
 const org=await store.createOrganization({name:'Inspection API',ownerId:'root',orgType:'personal'});
 const cookie=async(role:'root'|'viewer')=>sessionCookie+'='+await createSession({id:'u',username:'u',role,orgId:org.id,expiresAt:Date.now()+60000},process.env.SMARTDETECTOR_SESSION_SECRET!);
 const request=(body:unknown,c:string,origin='https://test.example')=>new NextRequest('https://test.example/api/v1/privacy/inspection',{method:'PUT',headers:{host:'test.example',origin,cookie:c},body:JSON.stringify(body)});
 const root=await cookie('root');
 assert.equal((await GET(new NextRequest('https://test.example/api/v1/privacy/inspection'))).status,403);
 assert.equal((await PUT(request({enabled:true},await cookie('viewer')))).status,403);
 assert.equal((await PUT(request({enabled:true},root,'https://foreign.example'))).status,403);
 for(const body of [{enabled:'yes'},{enabled:true,extra:1}])assert.equal((await PUT(request(body,root))).status,400);
 assert.equal((await PUT(request({enabled:true},root))).status,200);assert.equal((await store.settings(org.id)).privacy.enhancedInspection,true);
 assert.deepEqual(await(await GET(new NextRequest('https://test.example/api/v1/privacy/inspection',{headers:{cookie:root}}))).json(),{enabled:true});
});
