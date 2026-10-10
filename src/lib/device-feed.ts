export type FeedDevice={serverId:string;displayName:string;status:string;lastHeartbeat:string;providerKey?:string;platform?:string;modelId?:string};
export type FeedEvent={incidentId:string;serverId:string;startedAt:string;payload:unknown};
export function deviceGroup(device:FeedDevice){if(device.providerKey==='ring'||device.platform==='ring'||device.serverId.startsWith('ring-'))return 'Cameras';if(device.providerKey==='firetv'||device.platform==='firetv')return 'TV displays';return 'Sensors & other devices';}
export function latestDeviceEvent(events:FeedEvent[],id:string){return events.filter(e=>e.serverId===id&&Number.isFinite(Date.parse(e.startedAt))).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0];}
