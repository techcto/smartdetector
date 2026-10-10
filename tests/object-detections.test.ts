import {test} from 'node:test';
import assert from 'node:assert/strict';
import {objectDetections,detectionFrames} from '../src/lib/object-detections';
import {evidenceFrames} from '../src/lib/vision-analysis';
import {eventView} from '../src/lib/event-view';
test('object boxes preserve normalized coordinates, sources and advisory distinction',()=>{
 const box={x:.1,y:.2,width:.3,height:.4};
 const detections=objectDetections([{label:'person',score:1.4,box},{label:'package',source:'bedrock',box},{label:'dog',source:'bedrock',box}]);
 assert.equal(detections.length,3);assert.equal(detections[0].advisory,false);assert.equal(detections[0].score,1.4);assert.equal(detections[2].advisory,true);
 assert.equal(objectDetections([{label:'person',box:{...box,width:2}},{label:'<svg>',box},{label:'dog',source:'untrusted',box}]).length,0);
 const frames=evidenceFrames([{image:Buffer.from([255,216,255,0]).toString('base64'),at_ms:0}],[{at_ms:0,detections}]);
 assert.equal(frames[0].detections.length,3);assert.equal(eventView({kind:'vision-review',evidenceFrames:frames}).evidenceFrames[0].detections.length,3);
 assert.equal(detectionFrames([{at_ms:-1,detections}]).length,0);
});
