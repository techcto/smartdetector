import {eventView} from './event-view';
import type {IncidentRecord,Node} from './model';
export type SearchPlan={labels:string[];deviceIds:string[];period:'all'|'today'|'yesterday'|'week';terms:string[];notes:string[]};
export class SearchInputError extends Error {}
const groups:Record<string,string[]>={vehicle:['car','truck','bus','motorcycle','bicycle','vehicle'],person:['person'],pet:['dog','cat'],package:['package','parcel','box'],smoke:['smoke'],fire:['fire']};
const synonyms:Record<string,string>={vehicles:'vehicle',cars:'car',trucks:'truck',buses:'bus',motorcycles:'motorcycle',bikes:'bicycle',bike:'bicycle',people:'person',persons:'person',everyone:'person',anyone:'person',someone:'person',who:'person',visitors:'person',visitor:'person',pets:'pet',dogs:'dog',cats:'cat',packages:'package',parcels:'package',parcel:'package',boxes:'package'};
const stop=new Set('show me my our every all the that a an on in at of from with and or detected detection detections events event footage video videos image images saved camera cameras entered entering enter approached approaching arrived arriving was were is are please find search for today yesterday this week last seven 7 days'.split(' '));
export function validTimeZone(value:unknown){if(typeof value!=='string'||value.length>80)throw new SearchInputError('Invalid timezone');try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format()}catch{throw new SearchInputError('Invalid timezone')}return value;}
function day(at:number,timeZone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');}
export function planEventSearch(query:string,devices:Node[]):SearchPlan{
 const q=query.toLowerCase(),words:string[]=q.match(/[a-z0-9]+/g)??[],normalized=words.map(w=>synonyms[w]??w);
 if(/\b(no|not|without|except|excluding|before|after|between)\b/.test(q))throw new SearchInputError('This search supports positive object matches, camera names, today, yesterday, or last 7 days. Please rephrase complex exclusions or time ranges.');
 const period=/\byesterday\b/.test(q)?'yesterday':/\btoday\b/.test(q)?'today':/\b(this week|last (7|seven) days)\b/.test(q)?'week':'all';
 if(/\btoday\b/.test(q)&&/\byesterday\b/.test(q))throw new SearchInputError('Choose today or yesterday, not both');
 const labels=[...new Set(normalized.flatMap(w=>groups[w]??Object.values(groups).flat().filter(label=>label===w)))];
 const named=devices.filter(d=>q.includes(d.displayName.toLowerCase())&&d.displayName.trim().length>1);
 const mentioned=named.filter(d=>!named.some(other=>other!==d&&other.displayName.toLowerCase().includes(d.displayName.toLowerCase())&&other.displayName.length>d.displayName.length));
 const areas=['driveway','porch','yard','garage','door','backyard','entryway'];
 const requestedAreas=areas.filter(a=>words.includes(a));
 const matches=mentioned.length?mentioned:devices.filter(d=>requestedAreas.some(a=>d.displayName.toLowerCase().includes(a)));
 const deviceIds=matches.map(d=>d.serverId),notes=['Search covers retained saved events, not continuous video or guaranteed complete activity. Object detections may be advisory.'];
 if(labels.includes('person'))notes.push('Person matches are saved events, not identified people or a count of unique visitors.');
 if(requestedAreas.length&&!matches.length)throw new SearchInputError('No camera name matches that area in this location. Name a camera as shown under Devices.');
 if(/\b(enter|entered|entering|approach|approached|arrived|arriving)\b/.test(q))notes.push('Direction and zone crossing are not verified: results show objects observed on the matching cameras.');
 const nameWords=new Set(matches.flatMap(d=>d.displayName.toLowerCase().match(/[a-z0-9]+/g)??[]));
 const terms=normalized.filter(w=>!stop.has(w)&&!groups[w]&&!Object.values(groups).flat().includes(w)&&!nameWords.has(w)&&!requestedAreas.includes(w));
 return {labels,deviceIds,period,terms:[...new Set(terms)],notes};
}
export function matchEventSearch(rows:IncidentRecord[],plan:SearchPlan,timeZone:string,now=Date.now()){
 const today=day(now,timeZone),[year,month,dateOfMonth]=today.split('-').map(Number),yesterday=day(Date.UTC(year,month-1,dateOfMonth)-86400000,'UTC');
 return rows.filter(row=>{
  if(plan.deviceIds.length&&!plan.deviceIds.includes(row.serverId))return false;
  const at=Date.parse(row.startedAt);if(!Number.isFinite(at)||at>now)return false;
  const date=day(at,timeZone);if(plan.period==='today'&&date!==today||plan.period==='yesterday'&&date!==yesterday||plan.period==='week'&&(at<now-7*86400000))return false;
  const view=eventView(row.payload),labels=new Set([...view.observations.filter(o=>o.detected).map(o=>o.type),...view.detectionFrames.flatMap(f=>f.detections.map(d=>d.label)),...view.evidenceFrames.flatMap(f=>f.detections.map(d=>d.label)),...(view.signalValue!==null&&view.signalValue>0?[view.kind]:[])]);
  if(plan.labels.length&&!plan.labels.some(label=>labels.has(label)))return false;
  const text=(view.aiSummary+' '+view.assessment+' '+view.kind+' '+view.source).toLowerCase();return plan.terms.every(term=>text.includes(term));
 }).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
}
