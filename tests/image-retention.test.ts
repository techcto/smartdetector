import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {store} from '../src/lib/store';
import {state} from '../src/lib/memory-store';
import {DAY_MS,imageRetention,evidenceExpiry} from '../src/lib/image-retention';
import {defaultSettings} from '../src/lib/model';
import {createSession,sessionCookie} from '../src/lib/session';
import {proxy} from '../src/proxy';
import {GET,PUT} from '../src/app/api/v1/privacy/retention/route';
test('deletion settings require login and preserve destination; privacy instructions remain public',async()=>{
 for(const path of ['/settings/account-deletion','/settings/data-deletion']){
  const response=await proxy(new NextRequest('https://test.example'+path));
  assert.equal(response.status,307);const target=new URL(response.headers.get('location')!);assert.equal(target.pathname,'/login');assert.equal(target.searchParams.get('next'),path);
 }
 assert.equal((await proxy(new NextRequest('https://test.example/privacy'))).headers.get('x-middleware-next'),'1');
 for(const path of ['/account-deletion','/data-deletion'])assert.equal((await proxy(new NextRequest('https://test.example'+path))).status,307);
});
test('retention is opt-in, paid-only, bounded, and legacy deadlines cannot extend',async()=>{
 const settings=defaultSettings('test'),products=await store.products(),paid={id:'s',orgId:'test',productId:'starter',stripeSubscriptionId:'sub_test',status:'active' as const,updatedAt:new Date().toISOString()};
 assert.equal(imageRetention(settings,[paid],products).days,1);
 settings.privacy.imageRetentionDays=30;
 assert.equal(imageRetention(settings,[],products).days,1);
 assert.equal(imageRetention(settings,[{...paid,status:'trialing'}],products).days,1);
 assert.equal(imageRetention(settings,[{...paid,stripeSubscriptionId:undefined}],products).days,1);
 assert.equal(imageRetention(settings,[paid],products).days,30);
 const at=Date.now();assert.equal(evidenceExpiry({startedAt:new Date(at).toISOString()},30),at+DAY_MS);
 assert.equal(evidenceExpiry({startedAt:new Date(at).toISOString(),ttl:Math.floor((at+DAY_MS)/1000)},30),Math.floor((at+DAY_MS)/1000)*1000);
});
test('expired evidence disappears across all reads and cleanup physically deletes only that workspace',async()=>{
 const org=await store.createOrganization({name:'Retention',ownerId:'test',orgType:'personal'}),other=await store.createOrganization({name:'Other',ownerId:'test',orgType:'personal'}),at=new Date(Date.now()-2*DAY_MS).toISOString();
 const expired={tenantId:org.id,serverId:'camera',agentId:'test',incidentId:'expired',state:'review',startedAt:at,updatedAt:at,payload:{thumbnail:'private-image'}};
 state.incidents.set(org.id+'\0expired',expired);
 state.incidents.set(other.id+'\0expired',{...expired,tenantId:other.id});
 assert.equal(await store.incident(org.id,'expired'),null);assert.deepEqual(await store.incidents(org.id),[]);assert.deepEqual(await store.incidentsForNode(org.id,'camera'),[]);assert.deepEqual((await store.searchableIncidents(org.id)).rows,[]);
 assert.equal(await store.expireEvidence(org.id),1);assert.equal(state.incidents.has(org.id+'\0expired'),false);assert.equal(state.incidents.has(other.id+'\0expired'),true);
 await assert.rejects(store.putIncident(expired),/expired/);
 const now=new Date().toISOString();await store.putIncident({...expired,incidentId:'new',startedAt:now,updatedAt:now});
 const before=(await store.incident(org.id,'new'))!;assert.ok(before.ttl);assert.ok(before.ttl!*1000<=Date.now()+DAY_MS);
 await store.putSubscription({id:'paid',orgId:org.id,productId:'starter',stripeSubscriptionId:'sub_test',status:'active',updatedAt:now});
 const settings=await store.settings(org.id);await store.putSettings(org.id,{...settings,privacy:{...settings.privacy,imageRetentionDays:30}});
 await store.putIncident({...before,updatedAt:new Date().toISOString()});assert.equal((await store.incident(org.id,'new'))!.ttl,before.ttl);
 await store.putIncident({...expired,incidentId:'paid-new',startedAt:now,updatedAt:now});assert.ok((await store.incident(org.id,'paid-new'))!.ttl!*1000>Date.now()+29*DAY_MS);
 await store.putSubscription({id:'paid',orgId:org.id,productId:'starter',stripeSubscriptionId:'sub_test',status:'canceled',updatedAt:now});
 assert.equal((await store.settings(org.id)).privacy.imageRetentionDays,1);
 await store.putSubscription({id:'paid',orgId:org.id,productId:'starter',stripeSubscriptionId:'sub_test',status:'active',updatedAt:now});assert.equal((await store.imageRetention(org.id)).days,1);
});
test('retention API rejects unauthenticated, cross-origin and unpaid extensions',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-retention-session-secret-long-enough';
 const org=await store.createOrganization({name:'Retention API',ownerId:'test',orgType:'personal'}),token=await createSession({id:'root',username:'root',role:'root',orgId:org.id,expiresAt:Date.now()+60000},process.env.SMARTDETECTOR_SESSION_SECRET);
 const request=(days:unknown,origin='https://test.example')=>new NextRequest('https://test.example/api/v1/privacy/retention',{method:'PUT',headers:{host:'test.example',origin,cookie:sessionCookie+'='+token},body:JSON.stringify({days})});
 assert.equal((await GET(new NextRequest('https://test.example/api/v1/privacy/retention'))).status,403);
 assert.equal((await PUT(request(1,'https://foreign.example'))).status,403);
 assert.equal((await PUT(request(30))).status,403);assert.equal((await PUT(request(0))).status,400);assert.equal((await PUT(request(1))).status,200);
});
