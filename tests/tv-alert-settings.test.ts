import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {GET,POST} from '../src/app/api/v1/tv/push/route';
import {issueTvAccess} from '../src/lib/tv';
import {store} from '../src/lib/store';
test('TV alert capability is authenticated and disabling works even with messaging unconfigured',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-tv-alert-settings-secret';
 const org=await store.createOrganization({name:'TV alert settings test',ownerId:'root',orgType:'personal'});
 const access=await issueTvAccess(org.id,'root','Test console');
 const req=(body?:unknown)=>new NextRequest('http://localhost/api/v1/tv/push',{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+access.token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal((await GET(new NextRequest('http://localhost/api/v1/tv/push'))).status,401);
 process.env.SMARTDETECTOR_ADM_ENABLED='false';assert.deepEqual(await (await GET(req())).json(),{configured:false});
 assert.equal((await POST(req({registrationId:'synthetic-registration'}))).status,503);
 assert.equal((await POST(req({registrationId:null}))).status,200);
 process.env.SMARTDETECTOR_ADM_ENABLED='true';assert.deepEqual(await (await GET(req())).json(),{configured:true});
});
