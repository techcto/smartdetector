import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {createSession,sessionCookie} from '../src/lib/session';
import {POST as createLocation,GET as listLocations} from '../src/app/api/orgs/route';
import {POST as switchLocation} from '../src/app/api/orgs/active/route';
test('SaaS root can create and switch locations; private mode blocks both',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-location-test-session-secret';
 process.env.SMARTDETECTOR_DEPLOYMENT_MODE='saas';
 const token=await createSession({id:'root',username:'root',role:'root',orgId:'synthetic-root',expiresAt:Date.now()+60000},process.env.SMARTDETECTOR_SESSION_SECRET);
 const headers={'Content-Type':'application/json',Cookie:sessionCookie+'='+token};
 const created=await createLocation(new NextRequest('http://localhost/api/orgs',{method:'POST',headers,body:JSON.stringify({name:'Synthetic location verification'})}));assert.equal(created.status,201);const location=await created.json();
 const listed=await listLocations(new NextRequest('http://localhost/api/orgs',{headers}));assert.ok((await listed.json()).some((o:{id:string})=>o.id===location.id));
 const switched=await switchLocation(new NextRequest('http://localhost/api/orgs/active',{method:'POST',headers,body:JSON.stringify({orgId:location.id})}));assert.equal(switched.status,200);assert.ok(switched.headers.get('set-cookie'));
 process.env.SMARTDETECTOR_DEPLOYMENT_MODE='on-premise';
 assert.equal((await createLocation(new NextRequest('http://localhost/api/orgs',{method:'POST',headers,body:'{}'}))).status,403);
 assert.equal((await switchLocation(new NextRequest('http://localhost/api/orgs/active',{method:'POST',headers,body:'{}'}))).status,403);
});
