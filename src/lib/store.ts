import{memoryStore}from'./memory-store';
import{dynamoStore}from'./dynamo-store';
import {DAY_MS,imageRetention,evidenceExpiry,evidenceVisible} from './image-retention';
import type {IncidentRecord,Subscription} from './model';
import {playgroundEnabled,playgroundRecord,removePlaygroundToken} from './ring-playground';
const raw=process.env.SMARTDETECTOR_TABLE?dynamoStore:memoryStore;
async function policy(org:string){return imageRetention(await raw.settings(org),await raw.subscriptions(org),await raw.products());}
export const store={...raw,
 async expirePlayground(org:string){
  if(!playgroundEnabled())return;
  const record=await playgroundRecord(org);
  if(record&&record.expiresAt<=Date.now())await removePlaygroundToken(org,record.id,record.expiresAt);
 },
 async imageRetention(org:string){return policy(org);},
 async putIncident(row:IncidentRecord){
  const {days}=await policy(row.tenantId),existing=await raw.incident(row.tenantId,row.incidentId);
  const ttl=Math.floor(Math.min(Math.min(Date.parse(row.startedAt),Date.now())+days*DAY_MS,row.ttl===undefined?Infinity:row.ttl*1000,existing?evidenceExpiry(existing,days):Infinity)/1000);
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
  if(!(await policy(row.orgId)).paid){
   const settings=await raw.settings(row.orgId);
   await raw.putSettings(row.orgId,{...settings,privacy:{...settings.privacy,imageRetentionDays:1},updatedAt:new Date().toISOString()});
   await raw.expireEvidence(row.orgId,1);
  }
 },
};

