import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceFrames} from '../src/lib/vision-analysis';
import {eventView} from '../src/lib/event-view';
test('event evidence retains bounded raster frames with sample timestamps',()=>{
 const image=Buffer.from([255,216,255,0]).toString('base64');
 const frames=evidenceFrames([0,1000,2000].map(at_ms=>({image,at_ms})));
 assert.equal(frames.length,3);assert.equal(frames[2].at_ms,2000);
 const view=eventView({kind:'vision-review',thumbnail:frames[0].preview,evidenceFrames:frames});assert.ok(view.preview);assert.equal(view.evidenceFrames.length,3);
 assert.equal(evidenceFrames([{image:Buffer.from('<svg/>').toString('base64'),at_ms:0}]).length,0);
 assert.equal(evidenceFrames([{image:'A'.repeat(60001),at_ms:0}]).length,0);
 assert.equal(eventView({evidenceFrames:[{at_ms:0,preview:'https://tracking.example/image.jpg'}]}).evidenceFrames.length,0);
});
test('AutoVision previews replace oversized Ring images and preserve per-frame boxes',()=>{
 const preview=Buffer.from([255,216,255,0]).toString('base64');
 const detection={label:'person',source:'bedrock',box:{x:0.1,y:0.1,width:0.2,height:0.3}};
 const inputs=[0,1000,2000].map(at_ms=>({at_ms,image:'A'.repeat(60004)}));
 const analysis=[2000,0,1000].map(at_ms=>({at_ms,preview,detections:[detection]}));
 const frames=evidenceFrames(inputs,analysis);
 assert.deepEqual(frames.map(f=>f.at_ms),[0,1000,2000]);
 assert.equal(frames[0].preview,'data:image/jpeg;base64,'+preview);
 assert.equal(frames[2].detections[0].label,'person');
 assert.equal(eventView({thumbnail:frames[0].preview,evidenceFrames:frames}).evidenceFrames.length,3);
});
test('untrusted previews are rejected with bounded original-image fallback',()=>{
 const image=Buffer.from([255,216,255,0]).toString('base64');
 for(const preview of ['https://example.com/image.jpg',Buffer.from('<svg/>').toString('base64'),'A'.repeat(60004)]){
  assert.equal(evidenceFrames([{image,at_ms:0}],[{at_ms:0,preview}])[0].preview,'data:image/jpeg;base64,'+image);
  assert.equal(evidenceFrames([{image:'A'.repeat(60004),at_ms:0}],[{at_ms:0,preview}]).length,0);
 }
 assert.equal(evidenceFrames([{image,at_ms:0}],[{at_ms:1000,preview:image}]).length,1);
});
