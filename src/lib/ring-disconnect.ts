import {setting,saveSetting,removeSetting} from './providers';
import {discardRingLinks,removeRingDestination} from './ring-link';
import {store} from './store';

export async function disconnectRing(orgId:string,id:string){
 const connection=await setting(orgId,id);
 if(!connection||connection.providerKey!=='ring')return false;
 // Keep the disabled record until cleanup completes so a failed request is retryable.
 await saveSetting(orgId,connection.userId,{id,providerKey:'ring',name:connection.name,enabled:false,settings:{}});
 if(connection.settings.accountId)await removeRingDestination(connection.settings.accountId,orgId,id);
 await discardRingLinks(orgId,id);
 for(const device of await store.nodes(orgId))if(device.connectionId===id)await store.detachDevice(orgId,device.serverId);
 return removeSetting(orgId,id);
}
