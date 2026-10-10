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
