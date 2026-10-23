import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeMessaging,refreshSummary} from '../src/settings-feedback.mjs';
test('native messaging succeeds or returns an actionable bounded error, not raw Amazon errors',async()=>{
 assert.equal(await nativeMessaging(async()=>'registered'), 'registered');
 await assert.rejects(nativeMessaging(async()=>{throw Error('AmazonDeviceMessagingError private native details');}),error=>/Background alerts remain off/.test(error.message)&&!error.message.includes('private native'));
 await assert.rejects(nativeMessaging(()=>new Promise(()=>{}),5),/Amazon messaging is unavailable/);
});
test('refresh feedback reports the actual loaded counts',()=>{
 const status=refreshSummary(3,8,new Date('2026-10-23T12:00:00Z'));
 assert.match(status,/Updated/);assert.match(status,/3 devices, 8 events/);assert.match(status,/every 5 seconds/);
});
