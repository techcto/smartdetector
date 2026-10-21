import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginTvPairing, approveTvPairing, pollTvPairing, inspectTvPairing} from '../src/lib/tv-pairing';
import {authorizeTv,disconnectTv} from '../src/lib/tv';
import {store} from '../src/lib/store';
test('TV pairing binds approval to organization, rejects guesses and reuse, and supports revocation', async () => {
  process.env.SMARTDETECTOR_SESSION_SECRET = 'synthetic-tv-secret-at-least-32-characters';
  const org = await store.createOrganization({name:'Synthetic TV workspace',ownerId:'test',orgType:'business'});
  const pair = await beginTvPairing('Synthetic display');
  assert.equal((await inspectTvPairing(pair.userCode))?.name,'Synthetic display');
  assert.equal((await pollTvPairing(pair.deviceCode)).error,'authorization_pending');
  assert.equal((await pollTvPairing(pair.deviceCode.slice(0,-1)+'!')).error,'invalid_device_code');
  const guessed = pair.deviceCode.slice(0,-1) + (pair.deviceCode.endsWith('A') ? 'B' : 'A');
  assert.equal((await pollTvPairing(guessed)).error,'invalid_device_code');
  assert.equal((await pollTvPairing(pair.deviceCode,pair.expiresAt+1)).error,'expired_token');
  await approveTvPairing(pair.userCode,org.id,'test');
  await assert.rejects(approveTvPairing(pair.userCode,org.id,'test'));
  const result = await pollTvPairing(pair.deviceCode);
  assert.ok(result.token);
  const access = await authorizeTv(result.token!); assert.equal(access?.orgId,org.id); assert.equal(access?.purpose,'tv-feed');
  assert.equal(await authorizeTv(result.token!+'tampered'),null);
  assert.equal(await disconnectTv('synthetic-other-location',access!.connectionId),false);
  assert.ok(await authorizeTv(result.token!));
  assert.equal(await disconnectTv(org.id,access!.connectionId),true);
  assert.equal(await authorizeTv(result.token!),null);
  assert.equal((await store.node(org.id,'firetv-'+access!.connectionId))?.status,'offline');
});
test('only one concurrent approval can succeed',async()=>{
  process.env.SMARTDETECTOR_SESSION_SECRET = 'synthetic-tv-secret-at-least-32-characters';
  const pair=await beginTvPairing('Concurrency demo');
  const results=await Promise.allSettled([approveTvPairing(pair.userCode,'synthetic-a','test'),approveTvPairing(pair.userCode,'synthetic-b','test')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('a TV that stops polling its feed shows offline instead of staying healthy forever',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET??='synthetic-tv-status-session-secret-long-enough';
 const {issueTvAccess}=await import('../src/lib/tv');const {GET:feed}=await import('../src/app/api/v1/tv/feed/route');const {NextRequest}=await import('next/server');const {displayStatus}=await import('../src/lib/store');
 const org=await store.createOrganization({name:'TV status',ownerId:'root',orgType:'personal'}),tv=await issueTvAccess(org.id,'root','Living room TV'),id='firetv-'+tv.connectionId;
 assert.equal((await store.node(org.id,id))!.status,'pending');// Paired but never polled.
 await feed(new NextRequest('http://localhost/api/v1/tv/feed',{headers:{authorization:'Bearer '+tv.token}}));
 assert.equal((await store.node(org.id,id))!.status,'healthy');
 const row=(await store.node(org.id,id))!,old=new Date(Date.now()-181000).toISOString();
 await store.upsertNode({...row,lastHeartbeat:old});
 assert.equal((await store.node(org.id,id))!.status,'offline');assert.equal((await store.nodes(org.id)).find(n=>n.serverId===id)!.status,'offline');
 await feed(new NextRequest('http://localhost/api/v1/tv/feed',{headers:{authorization:'Bearer '+tv.token}}));
 assert.equal((await store.node(org.id,id))!.status,'healthy');// Polling again recovers.
 const camera={tenantId:org.id,serverId:'ring-camera',agentId:'ring',displayName:'Door',providerKey:'ring',tags:[],status:'healthy' as const,createdAt:old,lastHeartbeat:old};
 assert.equal(displayStatus(camera,180).status,'healthy');// Cameras do not heartbeat; only displays age out.
 assert.equal(displayStatus({...camera,providerKey:'firetv',lastHeartbeat:'not a date'},180).status,'offline');
});
