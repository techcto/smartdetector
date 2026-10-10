import {test} from 'node:test';
import assert from 'node:assert/strict';
import {store} from '../src/lib/store';
import {saveSetting} from '../src/lib/providers';
import {syncRingCameras} from '../src/lib/device-connect';
test('Ring sync is idempotent and excludes empty video capability objects',async()=>{
 process.env.SMARTDETECTOR_SESSION_SECRET='synthetic-ring-session-secret-long-enough';
 const org=await store.createOrganization({name:'Synthetic sync location',ownerId:'test',orgType:'business'});
 const c=await saveSetting(org.id,'test',{providerKey:'ring',name:'Synthetic Ring',settings:{accessToken:'synthetic-token'}});
 const mock=(async()=>new Response(JSON.stringify({data:[{id:'synthetic-camera',attributes:{name:'Porch'},relationships:{capabilities:{data:{id:'camera'}}}},{id:'synthetic-chime',relationships:{capabilities:{data:{id:'chime'}}}}],included:[{id:'camera',type:'device-capabilities',attributes:{video:{codecs:['AVC']}}},{id:'chime',type:'device-capabilities',attributes:{video:{codecs:null}}}]})))as typeof fetch;
 assert.equal(await syncRingCameras(org.id,c.id,mock),1);
 assert.equal(await syncRingCameras(org.id,c.id,mock),1);
 const nodes=await store.nodes(org.id);assert.equal(nodes.length,1);assert.equal(nodes[0].displayName,'Porch');assert.equal(nodes[0].modelId,'ring-camera');assert.equal(nodes[0].connectionId,c.id);
});
