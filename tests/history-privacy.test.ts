import {test} from 'node:test';
import assert from 'node:assert/strict';
import {store} from '../src/lib/store';
import {historyCutoff} from '../src/lib/history-privacy';
import {GET,DELETE} from '../src/app/api/v1/privacy/history/route';
import {NextRequest} from 'next/server';
import {createSession,sessionCookie} from '../src/lib/session';
test('history purge deletes only active-location evidence, preserves devices and allows new events',async()=>{
 const a=await store.createOrganization({name:'Synthetic privacy A',ownerId:'test',orgType:'personal'}),b=await store.createOrganization({name:'Synthetic privacy B',ownerId:'test',orgType:'personal'}),at=new Date(Date.now()-1000).toISOString();
 for(const org of [a,b]){await store.upsertNode({tenantId:org.id,serverId:'test-camera',agentId:'ring',displayName:'Test camera',tags:[],status:'healthy',createdAt:at,lastHeartbeat:at});await store.putIncident({tenantId:org.id,serverId:'test-camera',agentId:'ring',incidentId:'test-event',state:'review',startedAt:at,updatedAt:at,payload:{thumbnail:'synthetic'}});await store.putEvent({tenantId:org.id,serverId:'test-camera',agentId:'ring',type:'motion',at})}
 const result=await store.purgeHistory(a.id);assert.equal(result.deleted,2);assert.equal((await store.incidents(a.id)).length,0);assert.equal((await store.eventsForNode(a.id,'test-camera')).length,0);assert.ok(await store.node(a.id,'test-camera'));assert.ok(await store.incident(b.id,'test-event'));assert.equal((await store.eventsForNode(b.id,'test-camera')).length,1);
 await assert.rejects(store.putIncident({tenantId:a.id,serverId:'test-camera',agentId:'ring',incidentId:'old-worker',state:'review',startedAt:at,updatedAt:at,payload:{}}));
 const next=new Date(result.cutoff+1).toISOString();await store.putIncident({tenantId:a.id,serverId:'test-camera',agentId:'ring',incidentId:'new-event',state:'review',startedAt:next,updatedAt:next,payload:{}});assert.ok(await store.incident(a.id,'new-event'));assert.equal(await historyCutoff(a.id),result.cutoff);
});
test('privacy endpoint requires administrator session, same origin, exact confirmation and matching active location',async()=>{
 const secret=process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-privacy-session-secret-long-enough',org=await store.createOrganization({name:'Synthetic privacy endpoint',ownerId:'test',orgType:'personal'});
 const token=await createSession({id:'root',username:'root',role:'root',orgId:org.id,expiresAt:Date.now()+60000},secret);
 const request=(origin:string,body:unknown,cookie=token)=>new NextRequest('https://test.example/api/v1/privacy/history',{method:'DELETE',headers:{host:'test.example',origin,cookie:sessionCookie+'='+cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await GET(new NextRequest('https://test.example/api/v1/privacy/history'))).status,403);
 assert.equal((await DELETE(request('https://evil.example',{locationId:org.id,confirmation:'DELETE HISTORY'}))).status,403);
 assert.equal((await DELETE(request('https://test.example',{locationId:'other-location',confirmation:'DELETE HISTORY'}))).status,400);
 assert.equal((await DELETE(request('https://test.example',{locationId:org.id,confirmation:'delete'}))).status,400);
 assert.equal(await historyCutoff(org.id),0);
 assert.equal((await DELETE(request('https://test.example',{locationId:org.id,confirmation:'DELETE HISTORY'}))).status,200);
});
