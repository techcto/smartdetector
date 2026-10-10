import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deviceModels,deviceIntegration} from '../src/lib/device-catalog';
test('device catalog distinguishes integration models from reporting instances',()=>{
 assert.equal(new Set(deviceModels.map(m=>m.id)).size,deviceModels.length);
 assert.equal(deviceIntegration({serverId:'ring-example'}),'ring');
 assert.equal(deviceIntegration({serverId:'display-example',platform:'firetv'}),'firetv');
 assert.equal(deviceIntegration({serverId:'unknown'}),null);
 assert.equal(deviceIntegration({serverId:'simulated',platform:'simulator'}),null);
});
