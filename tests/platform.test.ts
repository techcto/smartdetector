import{test}from'node:test';import assert from'node:assert/strict';import{alarm,validSignal,ingest}from'../src/lib/signals';import{store}from'../src/lib/store';import{createSession,verifySession}from'../src/lib/session';import{NextRequest}from'next/server';import{isLocalDynamoEndpoint}from'../src/lib/dynamo-store';import{POST as forgotPassword}from'../src/app/api/auth/forgot-password/route';
test('deterministic alarm and invalid readings',()=>{assert.equal(alarm({device_id:'demo',type:'smoke',value:49}),false);assert.equal(alarm({device_id:'demo',type:'smoke',value:50}),true);assert.equal(validSignal({device_id:'demo',type:'smoke',value:NaN}),false)});
test('signals and incidents remain isolated by organization',async()=>{const a=await store.createOrganization({name:'Synthetic A',ownerId:'test',orgType:'business'}),b=await store.createOrganization({name:'Synthetic B',ownerId:'test',orgType:'business'});await ingest(a.id,'test',{device_id:'demo',type:'smoke',value:80,event_id:'repeatable'});await ingest(a.id,'test',{device_id:'demo',type:'smoke',value:80,event_id:'repeatable'});assert.equal((await store.incidents(a.id)).length,1);assert.equal((await store.incidents(b.id)).length,0)});
test('session signature rejects tampering',async()=>{const s=await createSession({id:'test',username:'synthetic',role:'admin',orgId:'demo',expiresAt:Date.now()+60000},'a'.repeat(32));assert.ok(await verifySession(s,'a'.repeat(32)));assert.equal(await verifySession(s+'tampered','a'.repeat(32)),null)});


import{encryptSecret,decryptSecret,saveSetting,listSettings,publicSetting,credentials}from'../src/lib/providers';
test('provider credentials are encrypted, redacted, and tenant isolated',async()=>{process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-test-secret-32-characters-long';const a=await store.createOrganization({name:'Provider Synthetic A',ownerId:'test',orgType:'business'}),b=await store.createOrganization({name:'Provider Synthetic B',ownerId:'test',orgType:'business'});const v=await saveSetting(a.id,'test',{providerKey:'ring',name:'Demo',settings:{accessToken:'synthetic-secret'}});assert.notEqual(v.settings.accessToken,'synthetic-secret');assert.equal(publicSetting(v).settings.accessToken,'configured');assert.equal((await credentials(a.id,'ring'))?.accessToken,'synthetic-secret');assert.equal((await listSettings(b.id)).length,0);const encrypted=encryptSecret('value','tenant-a');assert.throws(()=>decryptSecret(encrypted,'tenant-b'))});
test('password reset links use the browser-facing Host, never the container address or X-Forwarded-Host',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-reset-origin-secret';
 const now=new Date().toISOString(),username='synthetic-reset-origin-'+Date.now();
 await store.putUser({id:'synthetic-reset-origin-'+Date.now(),username,displayName:'Synthetic Reset',status:'active',createdAt:now,updatedAt:now},'hash');
 const link=async(headers:Record<string,string>)=>(await (await forgotPassword(new NextRequest('http://0.0.0.0:3000/api/auth/forgot-password',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({username})}))).json()).resetLink as string;
 assert.match(await link({host:'localhost:8082','x-forwarded-host':'attacker.test'}),/^http:\/\/localhost:8082\/login\/reset-password\?token=/);
 assert.match(await link({host:'smartdetector.com','x-forwarded-proto':'https'}),/^https:\/\/smartdetector\.com\/login\/reset-password\?token=/);
});
test('only a local DynamoDB table is created by the app; AWS stays CloudFormation-managed',()=>{
 for(const endpoint of ['http://localhost:8000','http://127.0.0.1:18000','http://[::1]:8000','http://smartdetector-dynamodb:8000'])assert.equal(isLocalDynamoEndpoint(endpoint),true,endpoint);
 for(const endpoint of ['https://dynamodb.us-east-1.amazonaws.com','http://localhost.attacker.test','http://smartdetector-dynamodb.example.com','not a url','',undefined])assert.equal(isLocalDynamoEndpoint(endpoint),false,String(endpoint));
});
