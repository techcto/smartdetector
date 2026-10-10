import {randomUUID,createHash} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,PutCommand,QueryCommand,DeleteCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {encryptSecret,decryptSecret} from './providers';
import {store} from './store';
import {eventView} from './event-view';
import {measureFaces} from './face-service';
export type Person={id:string;name:string;family:boolean;saveActivity:boolean;recognize:boolean;notify:boolean;consentedAt?:string;enrolled:boolean;createdAt:string};
type PrivatePerson=Person&{version:number;reference?:{modelId:string;embedding:number[]}};
type RecordValue={pk:string;sk:string;encrypted:string;version?:number};
const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint:process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const shared=globalThis as typeof globalThis&{smartdetectorPeople?:Map<string,RecordValue>};
const memory=shared.smartdetectorPeople??=new Map<string,RecordValue>();
const pk=(org:string)=>'ORG#'+org;
async function rows(org:string,prefix:string){
 if(!process.env.SMARTDETECTOR_TABLE)return [...memory.values()].filter(r=>r.pk===pk(org)&&r.sk.startsWith(prefix));
 const items:RecordValue[]=[];let cursor:Record<string,unknown>|undefined;
 do{const r=await db.send(new QueryCommand({TableName:process.env.SMARTDETECTOR_TABLE,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pk(org),':prefix':prefix},ExclusiveStartKey:cursor,ConsistentRead:true}));items.push(...(r.Items??[]) as RecordValue[]);cursor=r.LastEvaluatedKey;}while(cursor);
 return items;
}
async function writePerson(org:string,value:PrivatePerson,expected:number){const sk='PERSON#'+value.id,row={pk:pk(org),sk,version:value.version,encrypted:encryptSecret(JSON.stringify(value),pk(org)+':'+sk)};if(process.env.SMARTDETECTOR_TABLE)await db.send(new PutCommand({TableName:process.env.SMARTDETECTOR_TABLE,Item:row,ConditionExpression:expected===0?'attribute_not_exists(#v)':'#v=:v',ExpressionAttributeNames:{'#v':'version'},...(expected?{ExpressionAttributeValues:{':v':expected}}:{})}));else{if((memory.get(row.pk+'|'+sk)?.version??0)!==expected)throw Error('Person changed; refresh');memory.set(row.pk+'|'+sk,row);}}
async function remove(org:string,sk:string){if(process.env.SMARTDETECTOR_TABLE)await db.send(new DeleteCommand({TableName:process.env.SMARTDETECTOR_TABLE,Key:{pk:pk(org),sk}}));else memory.delete(pk(org)+'|'+sk);}
function decode<T>(r:RecordValue):T{return JSON.parse(decryptSecret(r.encrypted,r.pk+':'+r.sk)) as T;}
function publicPerson(p:PrivatePerson):Person{return {id:p.id,name:p.name,family:p.family,saveActivity:p.saveActivity,recognize:p.recognize??false,notify:p.notify??true,enrolled:!!p.reference,createdAt:p.createdAt,...(p.consentedAt?{consentedAt:p.consentedAt}:{})};}
export async function listPeople(org:string){return (await rows(org,'PERSON#')).map(r=>publicPerson(decode<PrivatePerson>(r)));}
async function privatePerson(org:string,id:string):Promise<PrivatePerson|null>{
 const sk='PERSON#'+id;
 const r=process.env.SMARTDETECTOR_TABLE?(await db.send(new GetCommand({TableName:process.env.SMARTDETECTOR_TABLE,Key:{pk:pk(org),sk},ConsistentRead:true}))).Item as RecordValue|undefined:memory.get(pk(org)+'|'+sk);
 return r?decode<PrivatePerson>(r):null;
}
export async function person(org:string,id:string){const p=await privatePerson(org,id);return p?publicPerson(p):null;}
export async function savePerson(org:string,input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid person');
 const v=input as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['id','name','family','saveActivity','recognize','notify'].includes(k))||typeof v.name!=='string'||!v.name.trim()||v.name.length>80||typeof v.family!=='boolean'||typeof v.saveActivity!=='boolean'||(v.id!==undefined&&typeof v.id!=='string')||(v.recognize!==undefined&&typeof v.recognize!=='boolean')||(v.notify!==undefined&&typeof v.notify!=='boolean'))throw Error('Invalid person');
 const existing=v.id?await privatePerson(org,v.id as string):null;if(v.id&&!existing)throw Error('Person unavailable');
 // Consent can only be enabled through enrollment, never by a preference toggle.
 if(v.recognize===true&&!existing?.reference)throw Error('Enroll a consenting person first');
 const recognize=v.recognize===false?false:!!existing?.recognize;
 const value:PrivatePerson={version:(existing?.version??0)+1,id:existing?.id??randomUUID(),name:v.name.trim(),family:v.family,saveActivity:v.saveActivity,recognize,notify:recognize?(v.notify??existing?.notify??true) as boolean:true,enrolled:recognize&&!!existing?.reference,createdAt:existing?.createdAt??new Date().toISOString(),...(recognize&&existing?.reference?{reference:existing.reference,consentedAt:existing.consentedAt}:{})};
 // Disabling activity removes links, not the original camera event or its image.
 await writePerson(org,value,existing?.version??0);
 if(!value.saveActivity)for(const row of await rows(org,'SIGHTING#'+value.id+'#'))await remove(org,row.sk);
 return publicPerson(value);
}
export async function enrollmentEvidence(org:string,eventId:string,frameIndex:number){
 const event=await store.incident(org,eventId);if(!event||!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>11)throw Error('Event unavailable');
 const frame=eventView(event.payload).evidenceFrames[frameIndex];if(!frame)throw Error('Retained frame unavailable');
 const result=await measureFaces([{at_ms:frame.at_ms,image:frame.preview.split(',')[1]}]);return {frame,result};
}
const faceDigest=(preview:string,modelId:string,embedding:number[])=>createHash('sha256').update(JSON.stringify({preview,modelId,embedding})).digest('hex');
export async function enrollmentCandidates(org:string,id:string,eventId:string,frameIndex:number){
 const p=await privatePerson(org,id);if(!p)throw Error('Person unavailable');
 const {frame,result}=await enrollmentEvidence(org,eventId,frameIndex);
 return {preview:frame.preview,faces:result.frames[0].faces.map((f,index)=>({index,box:f.box,proof:encryptSecret(JSON.stringify({eventId,frameIndex,faceIndex:index,version:p.version,digest:faceDigest(frame.preview,result.model_id,f.embedding),expiresAt:Date.now()+300000}),`enrollment:${org}:${id}`)}))};
}
export async function enrollPerson(org:string,id:string,eventId:string,frameIndex:number,faceIndex:number,consent:boolean,proof:string){
 if(consent!==true||!Number.isInteger(faceIndex)||faceIndex<0||faceIndex>19)throw Error('Explicit consent and selected face required');
 const existing=await privatePerson(org,id);if(!existing)throw Error('Person unavailable');
 if(typeof proof!=='string'||proof.length>4096)throw Error('Inspect the selected face first');
 const claim=JSON.parse(decryptSecret(proof,`enrollment:${org}:${id}`));
 if(claim.eventId!==eventId||claim.frameIndex!==frameIndex||claim.faceIndex!==faceIndex||claim.version!==existing.version||!Number.isFinite(claim.expiresAt)||claim.expiresAt<Date.now())throw Error('Enrollment selection expired or changed');
 const {frame,result}=await enrollmentEvidence(org,eventId,frameIndex),face=result.frames[0].faces[faceIndex];if(!face||claim.digest!==faceDigest(frame.preview,result.model_id,face.embedding))throw Error('Face changed; inspect again');
 if(!await store.incident(org,eventId))throw Error('Evidence was purged');
 const value:PrivatePerson={...existing,version:(existing.version??0)+1,recognize:true,notify:true,enrolled:true,consentedAt:new Date().toISOString(),reference:{modelId:result.model_id,embedding:face.embedding}};
 await writePerson(org,value,existing.version??0);return publicPerson(value);
}
/** Server-only gallery. No unknown-person templates are persisted. */
export async function enrolledPeople(org:string){return (await rows(org,'PERSON#')).map(r=>decode<PrivatePerson>(r)).filter(p=>p.recognize&&p.reference);}
export async function removePerson(org:string,id:string){if(!await person(org,id))return false;await remove(org,'PERSON#'+id);for(const row of await rows(org,'SIGHTING#'+id+'#'))await remove(org,row.sk);return true;}
async function saveSighting(org:string,p:PrivatePerson,eventId:string,kind:'manual'|'matched'){
 if(!p.saveActivity)return;
 const sk='SIGHTING#'+p.id+'#'+eventId,row={pk:pk(org),sk,encrypted:encryptSecret(JSON.stringify({eventId,kind}),pk(org)+':'+sk)};
 if(process.env.SMARTDETECTOR_TABLE)await db.send(new TransactWriteCommand({TransactItems:[{ConditionCheck:{TableName:process.env.SMARTDETECTOR_TABLE,Key:{pk:pk(org),sk:'PERSON#'+p.id},ConditionExpression:'#v=:v',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':v':p.version}}},{ConditionCheck:{TableName:process.env.SMARTDETECTOR_TABLE,Key:{pk:pk(org),sk:'INCIDENT#'+eventId},ConditionExpression:'attribute_exists(pk)'}},{Put:{TableName:process.env.SMARTDETECTOR_TABLE,Item:row}}]}));
 else{if(!await store.incident(org,eventId))return;const current=memory.get(pk(org)+'|PERSON#'+p.id);if(current?.version!==p.version)return;memory.set(row.pk+'|'+sk,row);}
}
export async function saveMatchedActivity(org:string,eventId:string,sightings:{personId:string;version:number;at_ms:number}[]){for(const s of sightings){const p=await privatePerson(org,s.personId);if(p?.recognize&&p.saveActivity&&p.version===s.version)try{await saveSighting(org,p,eventId,'matched');}catch{/* Revocation/deletion wins over a late match. */}}}
export async function tagPersonEvent(org:string,id:string,eventId:string){
 const p=await privatePerson(org,id),event=await store.incident(org,eventId);
 if(!p||!p.saveActivity||!event)throw Error('Person or event unavailable; activity saving must be enabled');
 const view=eventView(event.payload);if(!view.observations.some(o=>o.type==='person'&&o.detected)&&!view.detectionFrames.some(f=>f.detections.some(d=>d.label==='person')))throw Error('Choose an event containing a detected person');
 await saveSighting(org,p,eventId,'manual');
}
export async function personTimeline(org:string,id:string){
 const p=await person(org,id);if(!p)return null;
 if(!p.saveActivity)return {person:p,events:[]};
 const links=await rows(org,'SIGHTING#'+id+'#');
 const events=[];
 for(const row of links){const {eventId,kind}=decode<{eventId:string;kind?:string}>(row),e=await store.incident(org,eventId);if(!e){await remove(org,row.sk);continue;}const view=eventView(e.payload);events.push({id:e.incidentId,deviceId:e.serverId,at:e.startedAt,preview:view.preview,summary:view.aiSummary||view.assessment||view.kind,assignment:kind==='matched'?'Automatic face match — review required':'Manually confirmed'});}
 events.sort((a,b)=>b.at.localeCompare(a.at));return {person:p,events};
}
/** Purges remove associations too; names/preferences/references remain a separate choice. */
export async function prunePersonActivity(org:string){for(const row of await rows(org,'SIGHTING#')){const {eventId}=decode<{eventId:string}>(row);if(!await store.incident(org,eventId))await remove(org,row.sk);}}
