import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('homepage uses one hero and three recorded demos, without simulated event buttons',()=>{
 const page=readFileSync('src/app/public-home.tsx','utf8');
 assert.equal((page.match(/<RecordedDemo /g)||[]).length,4);
 assert.doesNotMatch(page,/Send sample event|Start sample events|MediaWalkthrough/);
});
test('public demo analyses match their supplied videos and contain actual boxes',()=>{
 for(const clip of ['intruder','dognight','backyardintruder','package']){
  const recording=JSON.parse(readFileSync(`public/demo/${clip}-analysis.json`,'utf8'));
  assert.equal(recording.sha256,createHash('sha256').update(readFileSync(`public/demo/${clip}.mp4`)).digest('hex'));
  assert.equal(recording.classification.status,'complete');
  assert.ok(recording.frames.length>1&&recording.frames.length<=12);
  assert.ok(recording.frames.some((f:{detections:unknown[]})=>f.detections.length));
  for(const f of recording.frames){assert.ok(f.preview);for(const d of f.detections){assert.ok(['opencv','bedrock'].includes(d.source));for(const value of Object.values(d.box))assert.ok(typeof value==='number'&&value>=0&&value<=1);}}
 }
});
