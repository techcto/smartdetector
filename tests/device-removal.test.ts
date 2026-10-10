import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {store} from '../src/lib/store';
import {DELETE} from '../src/app/api/v1/devices/[id]/route';
import {createSession,sessionCookie} from '../src/lib/session';
import {restoreDevice} from '../src/lib/device-privacy';
import {ingest} from '../src/lib/signals';
test('device deletion is confirmed, location-scoped, erases evidence and blocks late writes',async()=>{
 const secret=process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-device-delete-secret-long-enough';
 const a=await store.createOrganization({name:'A',ownerId:'root',orgType:'business'}),b=await store.createOrganization({name:'B',ownerId:'root',orgType:'business'});
 const at=new Date(Date.now()-10000).toISOString();
 for(const [org,id] of [[a.id,'camera'],[a.id,'keep'],[b.id,'camera']]){await ingest(org,'test',{device_id:id,type:'motion',value:1},at);await store.putIncident({tenantId:org,serverId:id,agentId:'test',incidentId:org+'-'+id,state:'review',startedAt:at,updatedAt:at,payload:{evidenceFrames:[{preview:'data:image/jpeg;base64,test'}]}})}
 const token=await createSession({id:'root',username:'root',role:'root',orgId:a.id,expiresAt:Date.now()+60000},secret);
 const context={params:Promise.resolve({id:'camera'})};
 const request=(origin='https://test.example',confirmation='DELETE DEVICE')=>new NextRequest('https://test.example/api/v1/devices/camera',{method:'DELETE',headers:{host:'test.example',origin,cookie:sessionCookie+'='+token,'Content-Type':'application/json'},body:JSON.stringify({deviceId:'camera',confirmation})});
 assert.equal((await DELETE(new NextRequest('https://test.example',{method:'DELETE'}),context)).status,403);
 assert.equal((await DELETE(request('https://foreign.example'),context)).status,403);
 assert.equal((await DELETE(request(undefined,'bad'),context)).status,400);
 assert.equal((await DELETE(request(),context)).status,200);
 assert.equal(await store.node(a.id,'camera'),null);
 assert.equal(await store.incident(a.id,a.id+'-camera'),null);
 assert.equal((await store.eventsForNode(a.id,'camera')).length,0);
 assert.ok(await store.node(a.id,'keep'));assert.ok(await store.incident(b.id,b.id+'-camera'));
 await assert.rejects(ingest(a.id,'test',{device_id:'camera',type:'motion',value:1}));
 await restoreDevice(a.id,'camera');
 await assert.rejects(store.putIncident({tenantId:a.id,serverId:'camera',agentId:'test',incidentId:'late',state:'review',startedAt:at,updatedAt:at,payload:{}}));
 await ingest(a.id,'test',{device_id:'camera',type:'motion',value:1},new Date(Date.now()+1000).toISOString());assert.ok(await store.node(a.id,'camera'));
});
