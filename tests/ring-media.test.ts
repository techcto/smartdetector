import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RingClient} from '../src/lib/ring';
import {POST} from '../src/app/api/v1/devices/[id]/media/route';
import {NextRequest} from 'next/server';
import {createSession,sessionCookie} from '../src/lib/session';
import {store} from '../src/lib/store';
import {issueTvAccess,disconnectTv} from '../src/lib/tv';
import {GET as tvFeed} from '../src/app/api/v1/tv/feed/route';
test('TV hides displays and rejects other-location cameras, foreign origins and revoked display access',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-tv-media-session-secret-long-enough';
 const a=await store.createOrganization({name:'Synthetic TV A',ownerId:'test',orgType:'business'}),b=await store.createOrganization({name:'Synthetic TV B',ownerId:'test',orgType:'business'});
 const access=await issueTvAccess(a.id,'test','Synthetic TV');
 for(const org of [a,b])await store.upsertNode({tenantId:org.id,serverId:'camera-'+org.id,agentId:'ring',displayName:'Synthetic camera',providerKey:'ring',connectionId:'synthetic',externalId:'synthetic',tags:[],status:'pending',createdAt:new Date().toISOString(),lastHeartbeat:new Date(0).toISOString()});
 const headers={host:'test.example',origin:'https://test.example',authorization:'Bearer '+access.token,'Content-Type':'application/json'};
 const feed=await(await tvFeed(new NextRequest('https://test.example/api/v1/tv/feed',{headers}))).json();
 assert.equal(feed.devices.length,1);assert.equal(feed.devices[0].id,'camera-'+a.id);assert.equal(feed.devices[0].liveView,true);
 const request=(origin:string)=>new NextRequest('https://test.example/api/v1/devices/camera/media',{method:'POST',headers:{...headers,origin},body:JSON.stringify({action:'live',sdp:'v=0'})});
 const params={params:Promise.resolve({id:'camera-'+b.id})};
 assert.equal((await POST(request('https://test.example'),params)).status,404);
 assert.equal((await POST(request('https://foreign.example'),params)).status,403);
 await disconnectTv(a.id,access.connectionId);
 assert.equal((await POST(request('https://test.example'),params)).status,403);
});
test('Ring signed download accepts the regional Amazon device host but rejects lookalikes',async()=>{
 for(const host of ['download-us-east-1.prod.phoenix.devices.amazon.dev','download-us-east-1.prod.phoenix.devices.amazon.dev.evil.example','evil.amazon.dev']){
  let calls=0;const mock=(async(_url:RequestInfo|URL,init?:RequestInit)=>{calls++;if(calls===1)return new Response(null,{status:303,headers:{location:'https://'+host+'/v1/download?synthetic=1'}});assert.equal(new Headers(init?.headers).has('authorization'),false);assert.equal(init?.redirect,'error');return new Response(new Uint8Array([255,216,255,0]),{headers:{'Content-Type':'image/jpeg'}});})as typeof fetch;
  const promise=new RingClient('synthetic-token',mock).snapshot('synthetic-device',Date.now());
  if(host.endsWith('.amazon.dev')&&host.startsWith('download-')){assert.ok(await promise);assert.equal(calls,2);}else{await assert.rejects(promise,/Untrusted/);assert.equal(calls,1);}
 }
});
test('latest Ring image uses consent-filtered history when a time range crosses authorization',async()=>{
 const now=Date.now();let calls=0;const mock=(async(url:RequestInfo|URL,init?:RequestInit)=>{calls++;if(calls===1)return Response.json({errors:[{code:'TIME_RANGE_NOT_AUTHORIZED'}]},{status:403});if(calls===2){assert.match(String(url),/\/history\/devices\/synthetic-device\/events$/);return Response.json({data:[{attributes:{start:now-5000}},{attributes:{start:now-90000000}}]});}if(calls===3){const body=JSON.parse(String(init?.body));assert.equal(body.type,'at_timestamp');assert.equal(body.timestamp,now-5000);return new Response(null,{status:303,headers:{location:'https://download-us-east-1.prod.phoenix.devices.amazon.dev/v1/download'}});}assert.equal(new Headers(init?.headers).has('authorization'),false);return new Response(new Uint8Array([255,216,255,0]),{headers:{'Content-Type':'image/jpeg'}});})as typeof fetch;
 assert.ok(await new RingClient('synthetic-token',mock).snapshot('synthetic-device',now,undefined,true));assert.equal(calls,4);
});
test('latest Ring image requests a bounded window and never forwards the access token to media storage',async()=>{
 let count=0;const now=Date.now();const mock=(async(url:RequestInfo|URL,init?:RequestInit)=>{count++;if(count===1){const body=JSON.parse(String(init?.body));assert.equal(body.type,'latest_in_range');assert.equal(body.start_timestamp,now-86400000);assert.equal(body.end_timestamp,now);return new Response(null,{status:303,headers:{location:'https://media.ring.com/snapshot'}});}assert.equal(new Headers(init?.headers).has('authorization'),false);return new Response(new Uint8Array([255,216,255,0]),{headers:{'Content-Type':'image/jpeg'}});})as typeof fetch;
 assert.ok(await new RingClient('synthetic-token',mock).snapshot('synthetic-device',now,undefined,true));assert.equal(count,2);
});
test('camera media rejects cross-location requests and cross-origin actions before contacting Ring',async()=>{
 const secret=process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-media-test-session-secret-long-enough';
 const org=await store.createOrganization({name:'Synthetic media location',ownerId:'test',orgType:'business'});
 await store.upsertNode({tenantId:org.id,serverId:'synthetic-camera',agentId:'ring',displayName:'Synthetic camera',providerKey:'ring',connectionId:'synthetic-connection',externalId:'synthetic-external',tags:[],status:'pending',createdAt:new Date().toISOString(),lastHeartbeat:new Date(0).toISOString()});
 const token=await createSession({id:'root',username:'root',role:'root',orgId:'different-location',expiresAt:Date.now()+60000},secret);
 const req=(origin:string)=>new NextRequest('https://test.example/api/v1/devices/synthetic-camera/media',{method:'POST',headers:{host:'test.example',origin,cookie:sessionCookie+'='+token,'Content-Type':'application/json'},body:JSON.stringify({action:'snapshot'})});
 const params={params:Promise.resolve({id:'synthetic-camera'})};assert.equal((await POST(req('https://wrong.example'),params)).status,403);assert.equal((await POST(req('https://test.example'),params)).status,404);
});
