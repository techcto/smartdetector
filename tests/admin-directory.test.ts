import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {directoryDevices,directoryUsers} from '../src/lib/admin';
import {store} from '../src/lib/store';
const now=new Date().toISOString();
test('admin user directory lists each organization member once',async()=>{
 const user={id:randomUUID(),username:'synthetic-admin-'+randomUUID(),displayName:'Synthetic Admin Directory',status:'active' as const,createdAt:now,updatedAt:now};
 await store.putUser(user);
 for(const name of ['Synthetic home','Synthetic office']){const org=await store.createOrganization({name,ownerId:user.id,orgType:'business'});await store.putMembership({id:randomUUID(),orgId:org.id,userId:user.id,role:'viewer',status:'active',createdAt:now,updatedAt:now})}
 const rows=(await directoryUsers()).filter(r=>r.user.id===user.id);
 assert.equal(rows.length,1);assert.equal(rows[0].organizations,2);
});
test('admin device directory spans organizations and exposes inventory only',async()=>{
 const a=await store.createOrganization({name:'Synthetic device org A',ownerId:'root',orgType:'business'}),b=await store.createOrganization({name:'Synthetic device org B',ownerId:'root',orgType:'business'});
 for(const org of [a,b])await store.upsertNode({tenantId:org.id,serverId:'cam-1',agentId:'agent',displayName:'Front door',providerKey:'ring',connectionId:'secret-connection',externalId:'ring-device-id',tags:['private'],status:'healthy',createdAt:now,lastHeartbeat:now});
 const rows=(await directoryDevices()).filter(d=>d.orgId===a.id||d.orgId===b.id);
 assert.deepEqual(rows.map(d=>d.organization),['Synthetic device org A','Synthetic device org B']);
 assert.deepEqual(rows[0],{id:'cam-1',orgId:a.id,name:'Front door',provider:'Ring',status:'healthy',connectedAt:now,lastSeen:now,organization:'Synthetic device org A'});
});
