import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NextRequest} from 'next/server';
import {playgroundEnabled,playgroundDeadline,savePlaygroundToken,playgroundRecord,activePlayground} from '../src/lib/ring-playground';
import {ringAccess} from '../src/lib/ring-link';
import {syncRingCameras} from '../src/lib/device-connect';
import {store} from '../src/lib/store';
import {GET,POST} from '../src/app/api/local/ring-playground/route';
import {createSession,sessionCookie} from '../src/lib/session';
import {POST as media} from '../src/app/api/v1/devices/[id]/media/route';
const env={SMARTDETECTOR_LOCAL_PLAYGROUND:'true',SMARTDETECTOR_NOTIFICATION_MODE:'log',SMARTDETECTOR_DYNAMODB_ENDPOINT:'http://localhost:8000'};
const token=(exp:number)=>'synthetic.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.test';
const fakeRing:typeof fetch=async(input,init)=>{
 assert.equal(String(input),'https://api.amazonvision.com/v1/devices?include=capabilities');assert.match(String((init?.headers as Record<string,string>).Authorization),/^Bearer synthetic\./);
 return Response.json({data:['front','back'].map(id=>({id,attributes:{name:id},relationships:{capabilities:{data:{id:'caps'}}}})),included:[{id:'caps',type:'device-capabilities',attributes:{video:{codecs:['h264']}}}]});
};
test('Playground is local-only and JWT claims can only shorten the 30-minute maximum',()=>{
 assert.equal(playgroundEnabled(env),true);assert.equal(playgroundEnabled({}),false);
 assert.equal(playgroundEnabled({...env,SMARTDETECTOR_DYNAMODB_ENDPOINT:'https://dynamodb.us-east-1.amazonaws.com'}),false);
 assert.equal(playgroundEnabled({...env,SMARTDETECTOR_NOTIFICATION_MODE:'aws'}),false);
 for(const mode of ['saas','on-premise'])assert.equal(playgroundEnabled({...env,NODE_ENV:'production',SMARTDETECTOR_DEPLOYMENT_MODE:mode,SMARTDETECTOR_TABLE:'aws-table',SMARTDETECTOR_DYNAMODB_ENDPOINT:''}),false);
 for(const file of ['smartdetector.yaml','smartdetector-existing.yaml'])assert.ok(!readFileSync('devops/cloudformation/'+file,'utf8').includes('SMARTDETECTOR_LOCAL_PLAYGROUND'));
 assert.ok(!readFileSync('src/app/devices/integrations/[key]/page.tsx','utf8').includes('<RingPlayground'));
 assert.ok(readFileSync('src/app/devices/device-browser.tsx','utf8').includes('<RingPlayground/>'));
 assert.equal(playgroundDeadline(token(9999999999),100000),1900000);
 assert.equal(playgroundDeadline(token(200),100000),200000);assert.throws(()=>playgroundDeadline(token(1),100000));
});
test('token expires without deleting cameras/history; reconnect uses the same IDs and no refresh grant',async t=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-playground-encryption-secret-long-enough';Object.assign(process.env,env);
 const now=Date.now();t.mock.timers.enable({apis:['Date'],now});
 try{
  const org=await store.createOrganization({name:'Playground test',ownerId:'root',orgType:'personal'});
  const saved=await savePlaygroundToken(org.id,token(Math.floor(now/1000)+1800),fakeRing);assert.equal(await syncRingCameras(org.id,saved.id,fakeRing),2);
  const devices=await store.nodes(org.id);assert.equal(devices.length,2);assert.ok(devices.every(d=>d.displayName.startsWith('PLAYGROUND · ')));
  const record=(await playgroundRecord(org.id))!;assert.ok(record.encrypted.startsWith('enc:'));assert.ok(!record.encrypted.includes('synthetic.'));
  const at=new Date().toISOString();await store.putIncident({tenantId:org.id,serverId:devices[0].serverId,agentId:'test',incidentId:'retained',state:'review',startedAt:at,updatedAt:at,payload:{test:true}});
  t.mock.timers.tick(1800001);assert.equal(await activePlayground(org.id),null);assert.equal(await playgroundRecord(org.id),undefined);await assert.rejects(ringAccess(org.id,saved.id),/expired/);
  await store.expirePlayground(org.id);assert.equal((await store.nodes(org.id)).length,2);assert.ok(await store.incident(org.id,'retained'));
  const next=await savePlaygroundToken(org.id,token(Math.floor(Date.now()/1000)+1800),fakeRing);assert.equal(next.id,saved.id);await syncRingCameras(org.id,next.id,fakeRing);
  assert.deepEqual((await store.nodes(org.id)).map(d=>d.serverId).sort(),devices.map(d=>d.serverId).sort());assert.ok(await store.incident(org.id,'retained'));
  await assert.rejects(ringAccess('other-org',next.id),/expired/);
 }finally{t.mock.timers.reset();for(const k of Object.keys(env))delete process.env[k];}
});
test('Playground route denies anonymous, non-root, external-host and cross-origin access; status never returns secrets',async()=>{
 Object.assign(process.env,env);process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-playground-api-session-secret-long-enough';
 try{
  const signed=async(role:'root'|'admin')=>createSession({id:'root',username:'root',role,orgId:'empty',expiresAt:Date.now()+60000},process.env.SMARTDETECTOR_SESSION_SECRET!);
  const request=(cookie='',host='localhost',origin='http://localhost')=>new NextRequest('http://'+host+'/api/local/ring-playground',{method:'POST',headers:{host,origin,cookie},body:JSON.stringify({token:'synthetic-token'})});
  assert.equal((await POST(request())).status,404);assert.equal((await POST(request(sessionCookie+'='+await signed('admin')))).status,404);
  const cookie=sessionCookie+'='+await signed('root');assert.equal((await POST(request(cookie,'public.example','http://public.example'))).status,404);assert.equal((await POST(request(cookie,'localhost','https://foreign.example'))).status,404);
  const result=await GET(request(cookie));assert.equal(result.status,200);assert.deepEqual(await result.json(),{enabled:true,connected:false,expiresAt:null});
 }finally{for(const k of Object.keys(env))delete process.env[k];}
});
test('Playground live view uses existing media flow, caps duration and preserves the session query for stop',async()=>{
 Object.assign(process.env,env);process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-playground-media-session-secret-long-enough';
 const originalFetch=globalThis.fetch,requests:string[]=[];
 try{
  const org=await store.createOrganization({name:'Playground media',ownerId:'root',orgType:'personal'}),saved=await savePlaygroundToken(org.id,token(Math.floor(Date.now()/1000)+20),fakeRing);await syncRingCameras(org.id,saved.id,fakeRing);
  const device=(await store.nodes(org.id))[0],base='https://api.amazonvision.com/v1/devices/'+device.externalId+'/media/streaming/whep/sessions';
  globalThis.fetch=async(input,init)=>{requests.push(String(input));assert.ok(String((init?.headers as Record<string,string>).Authorization).startsWith('Bearer synthetic.'));return init?.method==='DELETE'?new Response(null,{status:204}):new Response('v=0\r\n',{status:201,headers:{location:base+'/session-1?location=synthetic-session','Content-Type':'application/sdp'}});};
  const cookie=sessionCookie+'='+await createSession({id:'root',username:'root',role:'root',orgId:org.id,expiresAt:Date.now()+60000},process.env.SMARTDETECTOR_SESSION_SECRET);
  const request=(body:unknown)=>new NextRequest('http://localhost/api/v1/devices/'+device.serverId+'/media',{method:'POST',headers:{host:'localhost',origin:'http://localhost',cookie},body:JSON.stringify(body)});
  const response=await media(request({action:'live',sdp:'v=0\r\n'}),{params:Promise.resolve({id:device.serverId})});assert.equal(response.status,200);const result=await response.json();assert.ok(result.maxSeconds>0&&result.maxSeconds<20);assert.ok(!JSON.stringify(result).includes('Bearer'));
  assert.equal((await media(request({action:'stop',ticket:result.ticket}),{params:Promise.resolve({id:device.serverId})})).status,200);assert.equal(requests[1],base+'/session-1?location=synthetic-session');
 }finally{globalThis.fetch=originalFetch;for(const k of Object.keys(env))delete process.env[k];}
});
test('a removed Playground camera returns only on an explicit token reconnect, without its deleted history',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-playground-restore-secret-long-enough';Object.assign(process.env,env);
 try{
  const org=await store.createOrganization({name:'Playground restore',ownerId:'root',orgType:'personal'});
  const saved=await savePlaygroundToken(org.id,token(Math.floor(Date.now()/1000)+1800),fakeRing);await syncRingCameras(org.id,saved.id,fakeRing);
  const [device]=await store.nodes(org.id),at=new Date().toISOString();
  await store.putIncident({tenantId:org.id,serverId:device.serverId,agentId:'test',incidentId:'before-removal',state:'review',startedAt:at,updatedAt:at,payload:{}});
  await store.removeDevice(org.id,device.serverId);assert.equal((await store.nodes(org.id)).length,1);
  assert.equal(await syncRingCameras(org.id,saved.id,fakeRing),1);assert.ok(!(await store.nodes(org.id)).some(d=>d.serverId===device.serverId));// Background syncs keep it removed.
  assert.equal(await syncRingCameras(org.id,saved.id,fakeRing,true),2);assert.ok(await store.node(org.id,device.serverId));
  assert.equal(await store.incident(org.id,'before-removal'),null);
 }finally{for(const k of Object.keys(env))delete process.env[k];}
});
