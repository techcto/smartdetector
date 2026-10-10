import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {planEventSearch,matchEventSearch,validTimeZone} from '../src/lib/event-search';
import {store} from '../src/lib/store';
import type {Node,IncidentRecord} from '../src/lib/model';
import {POST} from '../src/app/api/v1/events/search/route';
import {createSession,sessionCookie} from '../src/lib/session';
import {issueTvAccess,disconnectTv} from '../src/lib/tv';
import {proxy} from '../src/proxy';
const node=(id:string,name:string):Node=>({tenantId:'test',serverId:id,agentId:'ring',displayName:name,platform:'ring',tags:[],status:'healthy',createdAt:'2026-10-10T00:00:00Z',lastHeartbeat:'2026-10-10T00:00:00Z'});
const devices=[node('front','Front'),node('door','Front Door'),node('drive','Driveway')];
const event=(id:string,device:string,at:string,label:string,detected=true):IncidentRecord=>({tenantId:'test',serverId:device,agentId:'ring',incidentId:id,state:'review',startedAt:at,updatedAt:at,payload:{kind:'vision-review',observations:[{type:label,value:detected?1:0,detected}],classification:{summary:'A sample observation'}}});
test('every vehicle and everyone use structured labels, longest camera name, local day and honest notes',()=>{
 const vehicle=planEventSearch('Show me every vehicle that entered the driveway today',devices);assert.equal(vehicle.period,'today');assert.deepEqual(vehicle.deviceIds,['drive']);assert.ok(vehicle.labels.includes('car'));assert.deepEqual(vehicle.terms,[]);assert.ok(vehicle.notes.some(n=>n.includes('Direction')));
 const people=planEventSearch('Show me everyone at my front door today',devices);assert.deepEqual(people.labels,['person']);assert.deepEqual(people.deviceIds,['door']);assert.deepEqual(people.terms,[]);assert.ok(people.notes.some(n=>n.includes('unique')));
 const now=Date.parse('2026-10-10T05:00:00Z'),rows=[event('today','door','2026-10-10T04:30:00Z','person'),event('yesterday','door','2026-10-10T03:30:00Z','person'),event('negative','door','2026-10-10T04:35:00Z','person',false),event('other-camera','drive','2026-10-10T04:40:00Z','person')];
 assert.deepEqual(matchEventSearch(rows,people,'America/New_York',now).map(i=>i.incidentId),['today']);
 assert.deepEqual(matchEventSearch(rows,planEventSearch('people front door yesterday',devices),'America/New_York',now).map(i=>i.incidentId),['yesterday']);
 assert.throws(()=>planEventSearch('people at the backyard today',devices));assert.throws(()=>planEventSearch('people without packages',devices));assert.throws(()=>validTimeZone('not-a-zone'));
});
test('search isolates organizations, supports revocable TV tokens and searches beyond recent feed',async()=>{
 const secret=process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-search-session-secret-long-enough';
 for(const path of ['/api/v1/events/search','/api/v1/integrations/ring/token','/api/v1/integrations/ring/webhook'])assert.equal((await proxy(new NextRequest('https://test.example'+path))).headers.get('x-middleware-next'),'1');
 const a=await store.createOrganization({name:'A',ownerId:'root',orgType:'business'}),b=await store.createOrganization({name:'B',ownerId:'root',orgType:'business'});
 for(const org of [a,b]){await store.upsertNode({...node('door','Front Door'),tenantId:org.id});await store.putIncident({...event('private-'+org.id,'door',new Date(Date.now()-1000).toISOString(),'person'),tenantId:org.id})}
 const token=await createSession({id:'root',username:'root',role:'root',orgId:a.id,expiresAt:Date.now()+60000},secret);
 const request=(auth?:string,origin='https://test.example',body:unknown={query:'everyone at my front door today',timeZone:'UTC'})=>new NextRequest('https://test.example/api/v1/events/search',{method:'POST',headers:{host:'test.example',origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{cookie:sessionCookie+'='+token})},body:JSON.stringify(body)});
 assert.equal((await POST(new NextRequest('https://test.example',{method:'POST'}))).status,401);assert.equal((await POST(request(undefined,'https://foreign.example'))).status,403);
 const result=await(await POST(request())).json();assert.equal(result.matched,1);assert.equal(result.items[0].id,'private-'+a.id);
 for(let i=0;i<60;i++)await store.putIncident({...event('older-'+i,'door',new Date(Date.now()-2000-i).toISOString(),'person'),tenantId:a.id});
 const expanded=await(await POST(request())).json();assert.equal(expanded.matched,61);assert.equal(expanded.items.length,50);assert.equal(expanded.truncated,true);
 assert.equal((await POST(request(undefined,undefined,{query:'people',timeZone:'UTC',deviceId:'foreign-device'}))).status,404);
 const tv=await issueTvAccess(a.id,'root','Search display');assert.equal((await POST(request(tv.token))).status,200);await disconnectTv(a.id,tv.connectionId);assert.equal((await POST(request(tv.token))).status,401);
});
