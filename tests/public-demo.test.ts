import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoRecording,validateScenario} from '../src/lib/public-demo';
import {POST} from '../src/app/api/demo/analyze/route';
test('public demo accepts only fixed sample IDs',()=>{
 for(const value of [-1,3,'0',null,{},0.5])assert.throws(()=>validateScenario(value));
 for(const value of [0,1,2])assert.equal(validateScenario(value),value);
});
test('all three saved analyses replay without a network request or service credential',()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('Demo must not make network calls')};
 try{for(const id of [0,1,2]){const recording=demoRecording(id);assert.equal(recording.prerecorded,true);assert.equal(recording.notification_mode,'preview_only');assert.equal(recording.analysis.frames.length,6);assert.ok(recording.analysis.observations.length);assert.ok(!('job_id' in recording.analysis));}}finally{globalThis.fetch=previous}
});
test('demo route rejects foreign origins and accepts browser host with Docker port mapping',async()=>{
 const foreign=await POST(new Request('http://localhost:3000/api/demo/analyze',{method:'POST',headers:{host:'localhost:8082',origin:'https://evil.test','content-type':'application/json'},body:'{"scenario":0}'}));assert.equal(foreign.status,403);
 const local=await POST(new Request('http://localhost:3000/api/demo/analyze',{method:'POST',headers:{host:'localhost:8082',origin:'http://localhost:8082','content-type':'application/json'},body:'{"scenario":0}'}));assert.equal(local.status,200);assert.equal((await local.json()).prerecorded,true);
});
