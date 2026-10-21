import test from 'node:test';import assert from 'node:assert/strict';
import {dashboardDevices,deviceGroup,latestDeviceEvent} from '../src/lib/device-feed';
test('device feed groups real devices and uses the newest event for each device',()=>{
 const base={displayName:'Synthetic device',status:'pending',lastHeartbeat:''};
 assert.equal(deviceGroup({...base,serverId:'ring-test'}),'Cameras');
 assert.equal(deviceGroup({...base,serverId:'test',providerKey:'firetv'}),'TV displays');
 assert.equal(deviceGroup({...base,serverId:'sensor'}),'Sensors & other devices');
 const e=(incidentId:string,serverId:string,startedAt:string)=>({incidentId,serverId,startedAt,payload:{}});
 assert.equal(latestDeviceEvent([e('old','a','2026-01-01'),e('other','b','2026-03-01'),e('bad','a','bad'),e('new','a','2026-02-01')],'a')?.incidentId,'new');
 assert.equal(latestDeviceEvent([],'a'),undefined);
});

test('dashboard excludes TV viewers without removing camera and sensor sources',()=>{const devices=[{serverId:'cam',displayName:'Camera',status:'healthy',lastHeartbeat:'',providerKey:'ring'},{serverId:'tv',displayName:'Viewer',status:'healthy',lastHeartbeat:'',providerKey:'firetv'},{serverId:'sensor',displayName:'Sensor',status:'healthy',lastHeartbeat:''}];assert.deepEqual(dashboardDevices(devices).map(d=>d.serverId),['cam','sensor']);assert.equal(devices.length,3);assert.deepEqual(dashboardDevices([devices[1]]),[]);});
