import{memoryStore}from'./memory-store';
import{dynamoStore}from'./dynamo-store';
import {DAY_MS,imageRetention,evidenceExpiry,evidenceVisible} from './image-retention';
import type {IncidentRecord,Node,Subscription} from './model';
import {playgroundEnabled,playgroundRecord,removePlaygroundToken} from './ring-playground';
const raw=process.env.SMARTDETECTOR_TABLE?dynamoStore:memoryStore;
async function policy(org:string){return imageRetention(await raw.settings(org),await raw.subscriptions(org),await raw.products());}
// TV displays heartbeat on every feed poll (5 s). One that stopped polling is closed, unpaired or expired, not healthy.
export function displayStatus<T extends Node>(node:T,staleSeconds:number,now=Date.now()):T{
 if(node.providerKey!=='firetv'||node.status!=='healthy')return node;
 const seen=Date.parse(node.lastHeartbeat);
 return Number.isFinite(seen)&&now-seen<=staleSeconds*1000?node:{...node,status:'offline'};
}
async function staleSeconds(org:string){const value=(await raw.settings(org)).detection.heartbeatStaleSeconds;return Number.isFinite(value)&&value>0?value:180;}
export const store={...raw,
 async node(org:string,id:string){const row=await raw.node(org,id);return row?.providerKey==='firetv'&&row.status==='healthy'?displayStatus(row,await staleSeconds(org)):row;},
 async nodes(org:string){const rows=await raw.nodes(org);if(!rows.some(n=>n.providerKey==='firetv'&&n.status==='healthy'))return rows;const stale=await staleSeconds(org);return rows.map(n=>displayStatus(n,stale));},
 async expirePlayground(org:string){
  if(!playgroundEnabled())return;
  const record=await playgroundRecord(org);
  if(record&&record.expiresAt<=Date.now())await removePlaygroundToken(org,record.id,record.expiresAt);
 },
 async imageRetention(org:string){return policy(org);},
 async putIncident(row:IncidentRecord){
  const {days}=await policy(row.tenantId),existing=await raw.incident(row.tenantId,row.incidentId);
  // Updating a legacy row (no deadline) keeps it on the grace path; stamping a ttl would drop that protection.
  if(existing&&existing.ttl===undefined&&row.ttl===undefined){if(!evidenceVisible(existing,days))throw Error('Evidence retention expired');return raw.putIncident(row);}
  // Updates keep the stored deadline; new rows start from the workspace period.
  const ttl=Math.floor(Math.min(existing?evidenceExpiry(existing,days):Math.min(Date.parse(row.startedAt),Date.now())+days*DAY_MS,row.ttl===undefined?Infinity:row.ttl*1000)/1000);
  if(!Number.isFinite(ttl)||ttl*1000<=Date.now())throw Error('Evidence retention expired');
  await raw.putIncident({...row,ttl});
 },
 async incident(org:string,id:string){const row=await raw.incident(org,id);return row&&evidenceVisible(row,(await policy(org)).days)?row:null;},
 async incidents(org:string){const {days}=await policy(org);return (await raw.incidents(org)).filter(r=>evidenceVisible(r,days));},
 async incidentsForNode(org:string,id:string){const {days}=await policy(org);return (await raw.incidentsForNode(org,id)).filter(r=>evidenceVisible(r,days));},
 async searchableIncidents(org:string){const {days}=await policy(org),result=await raw.searchableIncidents(org);return {...result,rows:result.rows.filter(r=>evidenceVisible(r,days))};},
 async expireEvidence(org:string){await this.expirePlayground(org);return raw.expireEvidence(org,(await policy(org)).days);},
 async putSubscription(row:Subscription){
  await raw.putSubscription(row);
  // Keep the saved choice so reactivation restores it; unpaid reads already fall back to one day.
  if(!(await policy(row.orgId)).paid)await raw.expireEvidence(row.orgId,1);
 },
};

