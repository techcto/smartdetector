import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DeletionBlocked,deleteOrganization,deleteUserAccount,directoryDevices,directoryUsers,organizationDeletion,userDeletion} from '../src/lib/admin';
import {createApiKey,verifyApiKey} from '../src/lib/api-keys';
import {listSettings,saveSetting} from '../src/lib/providers';
import {listPeople,savePerson} from '../src/lib/people';
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
const member=(orgId:string,userId:string,role:'admin'|'operator'|'viewer',createdAt=now)=>store.putMembership({id:randomUUID(),orgId,userId,role,status:'active',createdAt,updatedAt:createdAt});
const syntheticUser=async(name:string)=>{const u={id:randomUUID(),username:'synthetic-'+randomUUID(),displayName:name,status:'active' as const,createdAt:now,updatedAt:now};await store.putUser(u,'hash');return u};
test('deleting a location removes its devices, saved events, integrations, people and API keys, and the accounts of members with no other location',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-admin-deletion-session-secret';
 const user=await syntheticUser('Synthetic Deletion Member'),org=await store.createOrganization({name:'Synthetic deletion location',ownerId:'root',orgType:'business'});
 const shared=await syntheticUser('Synthetic Shared Member'),elsewhere=await store.createOrganization({name:'Synthetic elsewhere location',ownerId:'root',orgType:'business'});
 await member(org.id,user.id,'viewer');await member(org.id,shared.id,'operator');await member(elsewhere.id,shared.id,'viewer');
 await store.upsertNode({tenantId:org.id,serverId:'cam-delete',agentId:'agent',displayName:'Synthetic porch',tags:[],status:'healthy',createdAt:now,lastHeartbeat:now});
 await store.putIncident({tenantId:org.id,serverId:'cam-delete',agentId:'agent',incidentId:randomUUID(),state:'open',startedAt:now,updatedAt:now,payload:{}});
 await saveSetting(org.id,user.id,{providerKey:'ring',name:'Synthetic Ring',settings:{accessToken:'synthetic-token'}});
 await savePerson(org.id,{name:'Synthetic person',family:false,saveActivity:true});
 const key=await createApiKey(org.id,user.id,{name:'Synthetic deletion key',scopes:['events:read'],expiresInDays:1});
 const impact=await organizationDeletion(org.id);
 assert.equal(impact?.blocker,null);assert.deepEqual(impact?.related.map(r=>r.items),[['Synthetic Deletion Member'],['Synthetic Shared Member'],['Synthetic porch'],['1 integration','1 API key','1 person record']]);
 assert.ok(!JSON.stringify(impact).includes('Synthetic person'),'people are counted, never named, in admin views');
 assert.equal(await deleteOrganization(org.id),true);
 assert.equal(await store.organizationById(org.id),null);assert.equal(await store.membership(org.id,user.id),null);
 assert.deepEqual(await store.nodes(org.id),[]);assert.deepEqual(await store.incidents(org.id),[]);
 assert.deepEqual(await listSettings(org.id),[]);assert.deepEqual(await listPeople(org.id),[]);
 assert.equal(await verifyApiKey(key.token,'events:read'),null,'API keys stop authenticating');
 assert.equal(await store.userById(user.id),null,'a member with no other location is deleted');assert.equal(await store.password(user.id),null);
 assert.ok(await store.userById(shared.id),'a member of another location keeps the account');assert.deepEqual((await store.orgsForUser(shared.id)).map(m=>m.org.id),[elsewhere.id]);
 assert.equal(await deleteOrganization(org.id),false);
});
test('location deletion is blocked by a live Stripe subscription and for the operator workspace',async()=>{
 const org=await store.createOrganization({name:'Synthetic paid location',ownerId:'root',orgType:'business'});
 await store.putSubscription({id:'sub_'+randomUUID(),orgId:org.id,productId:'starter',stripeCustomerId:'cus_synthetic',stripeSubscriptionId:'sub_synthetic',status:'active',updatedAt:now});
 assert.match((await organizationDeletion(org.id))?.blocker??'',/Stripe subscription/);
 await assert.rejects(deleteOrganization(org.id),DeletionBlocked);assert.ok(await store.organizationById(org.id));
 const workspace=await store.ensureSingleDeploymentOrg();
 assert.equal(await store.singleDeploymentOrgId(),workspace.id);
 await assert.rejects(deleteOrganization(workspace.id),DeletionBlocked);
});
test('deleting a user hands shared owned locations to an admin and deletes ones nobody else uses',async()=>{
 const owner=await syntheticUser('Synthetic Owner'),early=await syntheticUser('Synthetic Early Operator'),admin=await syntheticUser('Synthetic Later Admin');
 const solo=await store.createOrganization({name:'Synthetic solo location',ownerId:owner.id,orgType:'personal'}),shared=await store.createOrganization({name:'Synthetic shared location',ownerId:owner.id,orgType:'business'}),other=await store.createOrganization({name:'Synthetic other location',ownerId:'root',orgType:'business'});
 await member(solo.id,owner.id,'admin');await member(shared.id,owner.id,'admin');await member(other.id,owner.id,'viewer');
 const dormant=await syntheticUser('Synthetic Disabled Solo Member');await store.putMembership({id:randomUUID(),orgId:solo.id,userId:dormant.id,role:'viewer',status:'disabled',createdAt:now,updatedAt:now});
 await member(shared.id,early.id,'operator','2020-01-01T00:00:00.000Z');await member(shared.id,admin.id,'admin');
 const impact=await userDeletion(owner.id);
 assert.deepEqual(impact?.related.map(r=>r.items.sort()),[['Synthetic solo location'],['Synthetic shared location → Synthetic Later Admin'],['Synthetic other location','Synthetic shared location'],['Synthetic Disabled Solo Member']]);
 assert.equal(await deleteUserAccount(owner.id),true);
 assert.equal(await store.userById(owner.id),null);assert.equal(await store.password(owner.id),null);assert.deepEqual(await store.orgsForUser(owner.id),[]);
 assert.equal(await store.organizationById(solo.id),null);assert.equal(await store.userById(dormant.id),null,'a disabled member of a deleted solo location goes with it');
 assert.equal((await store.organizationById(shared.id))?.ownerId,admin.id);assert.ok(await store.userById(early.id),'members of surviving locations are kept');assert.ok(await store.organizationById(other.id));
 assert.equal((await store.membership(shared.id,early.id))?.role,'operator');
});
test('user deletion is blocked when an owned location nobody else uses still has a live subscription',async()=>{
 const owner=await syntheticUser('Synthetic Paying Owner'),org=await store.createOrganization({name:'Synthetic paying solo location',ownerId:owner.id,orgType:'personal'});
 await member(org.id,owner.id,'admin');
 await store.putSubscription({id:'sub_'+randomUUID(),orgId:org.id,productId:'starter',stripeSubscriptionId:'sub_synthetic',status:'past_due',updatedAt:now});
 await assert.rejects(deleteUserAccount(owner.id),DeletionBlocked);
 assert.ok(await store.userById(owner.id));assert.ok(await store.membership(org.id,owner.id),'nothing is removed when blocked');
});
