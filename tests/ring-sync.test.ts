import {test} from 'node:test';
import assert from 'node:assert/strict';
import {store} from '../src/lib/store';
import {saveSetting} from '../src/lib/providers';
import {syncRingCameras} from '../src/lib/device-connect';
import {disconnectRing} from '../src/lib/ring-disconnect';
import {devicePrivacy,assertDeviceHistory} from '../src/lib/device-privacy';
test('Ring sync is idempotent and excludes empty video capability objects',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-ring-session-secret-long-enough';
 const org=await store.createOrganization({name:'Synthetic sync location',ownerId:'test',orgType:'business'});
 const c=await saveSetting(org.id,'test',{providerKey:'ring',name:'Synthetic Ring',settings:{accessToken:'synthetic-token'}});
 const mock=(async()=>new Response(JSON.stringify({data:[{id:'synthetic-camera',attributes:{name:'Porch'},relationships:{capabilities:{data:{id:'camera'}}}},{id:'synthetic-chime',relationships:{capabilities:{data:{id:'chime'}}}}],included:[{id:'camera',type:'device-capabilities',attributes:{video:{codecs:['AVC']}}},{id:'chime',type:'device-capabilities',attributes:{video:{codecs:null}}}]})))as typeof fetch;
 assert.equal(await syncRingCameras(org.id,c.id,mock),1);
 assert.equal(await syncRingCameras(org.id,c.id,mock),1);
 const nodes=await store.nodes(org.id);assert.equal(nodes.length,1);assert.equal(nodes[0].displayName,'Porch');assert.equal(nodes[0].modelId,'ring-camera');assert.equal(nodes[0].connectionId,c.id);
});
test('explicit Ring reconnect restores detached authorized cameras without restoring old history',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-ring-session-secret-long-enough';
 const org=await store.createOrganization({name:'Synthetic reconnect location',ownerId:'test',orgType:'business'});
 const connection=()=>saveSetting(org.id,'test',{providerKey:'ring',name:'Synthetic Ring',settings:{accessToken:'synthetic-token'}});
 const mock=(async()=>new Response(JSON.stringify({data:[{id:'reconnect-camera',relationships:{capabilities:{data:{id:'camera'}}}}],included:[{id:'camera',type:'device-capabilities',attributes:{video:{codecs:['AVC']}}}]})))as typeof fetch;
 const old=await connection();assert.equal(await syncRingCameras(org.id,old.id,mock),1);
 const [device]=await store.nodes(org.id);
 await disconnectRing(org.id,old.id);assert.equal((await store.nodes(org.id)).length,0);
 const cutoff=(await devicePrivacy(org.id,device.serverId))!.cutoff;
 const next=await connection();
 assert.equal(await syncRingCameras(org.id,next.id,mock),0);
 assert.equal(await syncRingCameras(org.id,next.id,mock,true),1);
 assert.equal((await store.node(org.id,device.serverId))?.connectionId,next.id);
 assert.deepEqual(await devicePrivacy(org.id,device.serverId),{removed:false,cutoff});
 await assert.rejects(assertDeviceHistory(org.id,device.serverId,new Date(cutoff).toISOString()));
 await assertDeviceHistory(org.id,device.serverId,new Date(cutoff+1).toISOString());
 assert.equal(await syncRingCameras(org.id,next.id,mock,true),1);
 // Individually deleted cameras also remain removed during non-explicit discovery.
 await store.removeDevice(org.id,device.serverId);
 assert.equal(await syncRingCameras(org.id,next.id,mock),0);
 assert.equal(await syncRingCameras(org.id,next.id,mock,true),1);
 assert.equal(await syncRingCameras(org.id,old.id,mock,true).catch(()=>-1),-1);
});
