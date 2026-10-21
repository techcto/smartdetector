import {createHash} from 'node:crypto';
import {store} from './store';
import {deviceModels} from './device-catalog';
import {ringAccess} from './ring-link';
import {RingClient} from './ring';
import {devicePrivacy,restoreDevice} from './device-privacy';
export async function syncRingCameras(orgId:string,connectionId:string,fetcher:typeof fetch=fetch,restoreRemoved=false){
 const config=await ringAccess(orgId,connectionId,fetcher),document=await new RingClient(config.accessToken,fetcher).devices();let count=0;
 for(const resource of document.data){
  const externalId=resource.id;if(typeof externalId!=='string'||!/^[a-zA-Z0-9_.:-]{1,200}$/.test(externalId))continue;
  const serverId=(config.playgroundExpiresAt?connectionId+'-':'ring-')+createHash('sha256').update(externalId).digest('hex').slice(0,24),previous=await store.node(orgId,serverId),at=new Date().toISOString();
  // Removed cameras stay skipped unless the caller is an explicit reconnect (a freshly pasted Playground token). Deleted history stays deleted.
  if((await devicePrivacy(orgId,serverId))?.removed){if(!restoreRemoved||!config.playgroundExpiresAt)continue;await restoreDevice(orgId,serverId);}
  if(previous?.connectionId&&previous.connectionId!==connectionId)continue;
  await store.upsertNode({...previous,tenantId:orgId,serverId,agentId:'ring',providerKey:'ring',platform:'ring',connectionId,modelId:previous?.modelId??'ring-camera',externalId,displayName:(config.playgroundExpiresAt?'PLAYGROUND · ':'')+(typeof resource.attributes?.name==='string'?resource.attributes.name.slice(0,100):'Ring camera'),tags:config.playgroundExpiresAt?['ring-playground']:previous?.tags??[],status:config.playgroundExpiresAt?'healthy':previous?.status??'pending',createdAt:previous?.createdAt??at,lastHeartbeat:config.playgroundExpiresAt?at:previous?.lastHeartbeat??new Date(0).toISOString()});count++;
 }return count;
}
export async function connectRingDevice(orgId:string,connectionId:string,modelId:string,externalId:string,fetcher:typeof fetch=fetch){
 if(connectionId.startsWith('playground-'))throw Error('Use automatic Playground discovery');
 const model=deviceModels.find(m=>m.id===modelId&&m.providerKey==='ring');
 if(!model||typeof externalId!=='string'||!/^[a-zA-Z0-9_.:-]{1,200}$/.test(externalId))throw new Error('Invalid device selection');
 const config=await ringAccess(orgId,connectionId,fetcher),document=await new RingClient(config.accessToken,fetcher).devices();
 const resource=Array.isArray(document.data)&&document.data.find((d:{id?:string})=>d.id===externalId);
 if(!resource)throw new Error('Device is not authorized on this Ring connection');
 const serverId='ring-'+createHash('sha256').update(externalId).digest('hex').slice(0,24),previous=await store.node(orgId,serverId),at=new Date().toISOString();
 await restoreDevice(orgId,serverId);
 await store.upsertNode({...previous,tenantId:orgId,serverId,agentId:'ring',providerKey:'ring',platform:'ring',connectionId,modelId,externalId,displayName:typeof resource.attributes?.name==='string'?resource.attributes.name.slice(0,100):'Ring camera',tags:previous?.tags??[],status:previous?.status??'pending',createdAt:previous?.createdAt??at,lastHeartbeat:previous?.lastHeartbeat??new Date(0).toISOString()});
 return {serverId};
}
