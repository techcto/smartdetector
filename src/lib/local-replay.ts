import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {analyzeFrames,persistVisionAnalysis,type VisionResult} from './vision-analysis';
import {store} from './store';
export const replaySamples=['intruder','backyardintruder','package','dognight'] as const;
export const replayCameras={
 'front-door':{id:'local-ring-front-door',name:'TEST · Ring Front Door'},
 'back-yard':{id:'local-ring-back-yard',name:'TEST · Ring Back Yard'},
} as const;
export function replayCameraIdentity(camera:unknown){
 if(typeof camera!=='string'||!Object.hasOwn(replayCameras,camera))throw Error('Invalid test camera');
 return replayCameras[camera as keyof typeof replayCameras];
}
export async function labelReplayDevice(orgId:string,deviceId:string,sample:string,camera?:unknown){
 const identity=camera===undefined?null:replayCameraIdentity(camera),node=await store.node(orgId,deviceId);
 if(node)await store.upsertNode({...node,displayName:identity?.name??'TEST · '+sample,...(identity?{providerKey:'ring-test',platform:'ring-test',modelId:'local-ring-camera'}:{}),tags:[...new Set([...node.tags,'local-replay',...(identity?['ring-test-fixture']:[])])]});
}
const recent=new Map<string,number>();
export function claimLocalReplay(orgId:string,now=Date.now()){
 for(const [id,at] of recent)if(now-at>=3000)recent.delete(id);
 if(recent.has(orgId))return false;
 if(recent.size>=100)recent.delete(recent.keys().next().value!);
 recent.set(orgId,now);return true;
}
export function localReplayEnabled(env:NodeJS.ProcessEnv=process.env){
 if(env.SMARTDETECTOR_LOCAL_REPLAY!=='true'||env.SMARTDETECTOR_NOTIFICATION_MODE!=='log'||!env.SMARTDETECTOR_TABLE)return false;
 try{const u=new URL(env.SMARTDETECTOR_DYNAMODB_ENDPOINT??'');return u.protocol==='http:'&&!u.username&&!u.password&&['localhost','127.0.0.1','[::1]','smartdetector-dynamodb'].includes(u.hostname)}catch{return false}
}
export async function replayCamera(orgId:string,sample:unknown,mode:unknown,camera?:unknown){
 if(!localReplayEnabled())throw Error('Local replay is disabled');
 if(!replaySamples.includes(sample as typeof replaySamples[number])||!['recorded','live'].includes(String(mode)))throw Error('Invalid replay sample or mode');
 const name=String(sample),report=JSON.parse(await readFile(join(process.cwd(),'public/demo',name+'-analysis.json'),'utf8'));
 // Verify that saved frames/results belong to the included sample, never fetch arbitrary URLs.
 const bytes=await readFile(join(process.cwd(),'public/demo',name+'.mp4'));
 if(createHash('sha256').update(bytes).digest('hex')!==report.sha256)throw Error('Sample clip does not match its recorded report');
 const identity=camera===undefined?null:replayCameraIdentity(camera);
 const available=identity?(report.frames??[]).slice(0,3):report.frames??[];
 const frames=available.map((f:{at_ms:number;preview:string})=>({at_ms:f.at_ms,image:f.preview}));
 if(!frames.length||frames.length>12||frames.some((f:{at_ms:number;image:string},i:number)=>!Number.isFinite(f.at_ms)||f.at_ms<0||f.at_ms>30000||(i>0&&f.at_ms<=frames[i-1].at_ms)||typeof f.image!=='string'||f.image.length>60000||!/^[A-Za-z0-9+/]+={0,2}$/.test(f.image)))throw Error('Invalid recorded sample frames');
 const deviceId=identity?.id??'local-replay-'+name;
 const result=mode==='live'?await analyzeFrames(orgId,deviceId,frames,false,'local-replay-live',randomUUID()):await persistVisionAnalysis(orgId,deviceId,frames,report as VisionResult,'local-replay-recorded',randomUUID(),fetch,Date.now(),{sample:name,recordedAt:report.recordedAt});
 await labelReplayDevice(orgId,deviceId,name,camera);
 return {incidentId:result.incidentId,deviceId,mode,frames:frames.length,recordedAt:mode==='recorded'?report.recordedAt:null,newAnalysis:mode==='live',ringConnected:false,testCamera:!!identity};
}
