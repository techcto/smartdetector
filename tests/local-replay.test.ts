import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localReplayEnabled,claimLocalReplay,replayCamera,replayCameraIdentity,labelReplayDevice} from '../src/lib/local-replay';
import {testCameraOptions,runTestCameras} from '../devops/local/test-cameras.mjs';
import {deviceGroup} from '../src/lib/device-feed';
import {persistVisionAnalysis} from '../src/lib/vision-analysis';
import {readFileSync} from 'node:fs';
import {POST} from '../src/app/api/local/replay/route';
import {NextRequest} from 'next/server';
import {createSession,sessionCookie} from '../src/lib/session';
import {store} from '../src/lib/store';
import {issueTvAccess} from '../src/lib/tv';
import {GET as tvFeed} from '../src/app/api/v1/tv/feed/route';
import {replayOptions} from '../devops/local/replay-camera.mjs';
const local={SMARTDETECTOR_LOCAL_REPLAY:'true',SMARTDETECTOR_NOTIFICATION_MODE:'log',SMARTDETECTOR_TABLE:'local',SMARTDETECTOR_DYNAMODB_ENDPOINT:'http://smartdetector-dynamodb:8000'};
test('replay gate requires explicit opt-in, local storage and log-only notifications',()=>{
 assert.equal(localReplayEnabled(local),true);assert.equal(localReplayEnabled({}),false);
 for(const patch of [{SMARTDETECTOR_LOCAL_REPLAY:'false'},{SMARTDETECTOR_DYNAMODB_ENDPOINT:'https://dynamodb.us-east-1.amazonaws.com'},{SMARTDETECTOR_NOTIFICATION_MODE:'aws'},{SMARTDETECTOR_TABLE:''},{SMARTDETECTOR_DYNAMODB_ENDPOINT:'http://smartdetector-dynamodb.evil.example:8000'}])assert.equal(localReplayEnabled({...local,...patch}),false);
 assert.equal(claimLocalReplay('bounded-unit',10000),true);assert.equal(claimLocalReplay('bounded-unit',10001),false);assert.equal(claimLocalReplay('bounded-unit',13000),true);
});
test('CLI refuses external targets, redirects, invalid sample paths and unbounded loops',()=>{
 assert.equal(replayOptions([],{}).base,'http://localhost:8082');
 for(const args of [['--url','https://smartdetector.com'],['--url','http://localhost.evil.example'],['--url','http://user:pass@localhost'],['--sample','../../secret'],['--count','21'],['--interval','0']])assert.throws(()=>replayOptions(args,{}));
});
test('two-camera container stays bounded, loopback-only and recorded, with stable alternating identities',async()=>{
 assert.throws(()=>testCameraOptions({SMARTDETECTOR_REPLAY_URL:'https://smartdetector.com'}));
 for(const env of [{SMARTDETECTOR_TEST_EVENT_COUNT:'10001'},{SMARTDETECTOR_TEST_EVENT_INTERVAL:'0'},{SMARTDETECTOR_TEST_EVENT_COUNT:'1'}])assert.throws(()=>testCameraOptions(env));
 assert.throws(()=>replayCameraIdentity('__proto__'));assert.throws(()=>replayCameraIdentity('../../x'));
 assert.throws(()=>replayOptions(['--camera','invalid'],{}));
 const calls:{camera:string;mode:string;count:number}[]=[];
 await runTestCameras({SMARTDETECTOR_TEST_EVENT_COUNT:'4'},async(options:typeof calls[number])=>{calls.push(options)},async()=>{});
 assert.deepEqual(calls.map(v=>v.camera),['front-door','back-yard','front-door','back-yard']);assert.ok(calls.every(v=>v.mode==='recorded'&&v.count===1));
 assert.equal(deviceGroup({serverId:'local-ring-front-door',displayName:'TEST',status:'healthy',lastHeartbeat:'',providerKey:'ring-test'}),'Cameras');
});
test('two camera identities save real sample pixels in the normal scoped feed without Ring credentials',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='local-two-camera-test-secret-not-production';
 const savedFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No provider calls expected')};
 try{
  const org=await store.createOrganization({name:'Two test cameras',ownerId:'root',orgType:'personal'});
  for(const [camera,sample] of [['front-door','package'],['back-yard','dognight']]){
   const identity=replayCameraIdentity(camera),report=JSON.parse(readFileSync('public/demo/'+sample+'-analysis.json','utf8'));
   const frames=report.frames.slice(0,3).map((f:{at_ms:number;preview:string})=>({at_ms:f.at_ms,image:f.preview}));
   await persistVisionAnalysis(org.id,identity.id,frames,report,'local-replay-recorded','unit-'+camera,fetch,Date.now(),{sample,recordedAt:report.recordedAt});
   await labelReplayDevice(org.id,identity.id,sample,camera);
  }
  assert.equal((await store.nodes(org.id)).length,2);
  for(const row of await store.nodes(org.id)){assert.equal(row.providerKey,'ring-test');assert.match(row.displayName,/^TEST · Ring /);assert.equal(row.connectionId,undefined);}
  const incidents=await store.incidents(org.id);assert.equal(incidents.length,2);assert.ok(incidents.every(row=>(row.payload as {evidenceFrames:unknown[]}).evidenceFrames.length===3));
 }finally{globalThis.fetch=savedFetch;for(const key of Object.keys(local))delete process.env[key]}
});
test('local endpoint rejects disabled mode, other roles and cross-origin requests',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='local-replay-test-secret-not-production';
 const request=(origin:string,cookie='')=>new NextRequest('http://localhost/api/local/replay',{method:'POST',headers:{host:'localhost',origin,cookie},body:JSON.stringify({sample:'intruder'})});
 delete process.env.SMARTDETECTOR_LOCAL_REPLAY;assert.equal((await POST(request('http://localhost'))).status,404);
 Object.assign(process.env,local);
 try{
  assert.equal((await POST(request('https://evil.example'))).status,403);
  assert.equal((await POST(request('http://localhost'))).status,403);
  const token=await createSession({id:'test',username:'test',role:'admin',orgId:'org',expiresAt:Date.now()+60000},process.env.SMARTDETECTOR_SESSION_SECRET);
  assert.equal((await POST(request('http://localhost',sessionCookie+'='+token))).status,403);
 }finally{for(const key of Object.keys(local))delete process.env[key]}
});
test('recorded sample creates scoped event, frames and TV feed without Ring or AI',async()=>{
 // Store is selected at module load: this test deliberately uses the in-memory store.
 process.env.SMARTDETECTOR_SESSION_SECRET='local-replay-test-secret-not-production';
 const savedFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('Recorded replay must not call any provider')};
 try{
  const a=await store.createOrganization({name:'Local replay A',ownerId:'root',orgType:'business'}),b=await store.createOrganization({name:'Local replay B',ownerId:'root',orgType:'business'});
  await assert.rejects(replayCamera(a.id,'intruder','recorded'),/disabled/);
  const report=JSON.parse(readFileSync('public/demo/intruder-analysis.json','utf8'));
  const frames=report.frames.map((f:{at_ms:number;preview:string})=>({at_ms:f.at_ms,image:f.preview}));
  const deviceId='local-replay-intruder';
  const result=await persistVisionAnalysis(a.id,deviceId,frames,report,'local-replay-recorded','unit-replay',fetch,Date.now(),{sample:'intruder',recordedAt:report.recordedAt});
  const incident=await store.incident(a.id,result.incidentId);assert.ok(incident);assert.equal(incident.payload.source,'local-replay-recorded');
  assert.equal((incident.payload.evidenceFrames as unknown[]).length,12);assert.equal(await store.incident(b.id,result.incidentId),null);
  const display=await issueTvAccess(a.id,'root','Local test TV');
  const feed=await(await tvFeed(new NextRequest('http://localhost/api/v1/tv/feed',{headers:{authorization:'Bearer '+display.token}}))).json();
  assert.ok(feed.devices.some((d:{id:string})=>d.id===deviceId));
  const event=feed.incidents.find((i:{id:string})=>i.id===result.incidentId);assert.match(event.summary,/Recorded sample replay/);assert.equal(event.frames.length,12);
  const stranger=await issueTvAccess(b.id,'root','Other TV');
  const other=await(await tvFeed(new NextRequest('http://localhost/api/v1/tv/feed',{headers:{authorization:'Bearer '+stranger.token}}))).json();assert.equal(other.incidents.length,0);
 }finally{globalThis.fetch=savedFetch;for(const key of Object.keys(local))delete process.env[key]}
});
