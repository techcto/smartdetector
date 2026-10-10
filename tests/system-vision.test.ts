import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {GET,POST} from '../src/app/api/v1/integrations/autovision/route';
import {createSession,sessionCookie} from '../src/lib/session';
import {visionConfig} from '../src/lib/system-vision';
test('root-only AutoVision configuration keeps saved secrets server-side and preserves blank keys',async()=>{
 const secret=process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-admin-session-secret-long-enough';
 const token=await createSession({id:'root',username:'root',role:'root',orgId:'synthetic',expiresAt:Date.now()+60000},secret);
 const request=(method:string,origin='https://test.example',body?:unknown)=>new NextRequest('https://test.example/api/v1/integrations/autovision',{method,headers:{host:'test.example',origin,cookie:sessionCookie+'='+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await GET(new NextRequest('https://test.example/api/v1/integrations/autovision'))).status,403);
 assert.equal((await POST(request('POST','https://wrong.example',{url:'https://autovision.dev',apiKey:'synthetic-key'}))).status,403);
 assert.equal((await POST(request('POST',undefined,{url:'https://autovision.dev',apiKey:'synthetic-key'}))).status,200);
 assert.equal((await visionConfig()).apiKey,'synthetic-key');
 const response=await(await GET(request('GET'))).json();assert.equal(response.configured,true);assert.equal(response.managedBy,'admin');assert.equal(JSON.stringify(response).includes('synthetic-key'),false);
 assert.equal((await POST(request('POST',undefined,{url:'https://autovision.dev',apiKey:''}))).status,200);assert.equal((await visionConfig()).apiKey,'synthetic-key');
 assert.equal((await POST(request('POST',undefined,{url:'http://169.254.169.254',apiKey:'synthetic-key'}))).status,400);
});
