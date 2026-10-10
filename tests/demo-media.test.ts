import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {demoMedia,demoStage} from '../src/lib/demo-media';
test('demo media is local, credited and has explicit scripted observations',()=>{for(const media of demoMedia){assert.ok(existsSync('public'+media.image));if(media.video)assert.ok(existsSync('public'+media.video));assert.match(media.source,/^https:\/\/www\.pexels\.com\//);assert.match(media.observation,/^Example event:/);assert.match(media.context,/^Example AI context:/)}});
test('simulated notifications appear only after event and context stages',()=>{assert.equal(demoStage(0),0);assert.equal(demoStage(1.5),1);assert.equal(demoStage(3),2);assert.equal(demoStage(4.5),3)});
