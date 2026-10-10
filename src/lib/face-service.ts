import {visionConfig} from './system-vision';
import type {VisionFrame} from './vision-analysis';
export type FaceMeasurement={box:{x:number;y:number;width:number;height:number};embedding:number[]};
export type FaceResult={model_id:string;frames:{at_ms:number;faces:FaceMeasurement[]}[]};
export function validateFaceResult(value:unknown):FaceResult{
 const v=value as FaceResult;
 if(!v||typeof v.model_id!=='string'||!/^yunet:[a-f0-9]{64}\/sface:[a-f0-9]{64}$/.test(v.model_id)||!Array.isArray(v.frames)||v.frames.length>12)throw Error('Invalid face response');
 for(const frame of v.frames){if(!Number.isFinite(frame.at_ms)||!Array.isArray(frame.faces)||frame.faces.length>20)throw Error('Invalid face response');for(const f of frame.faces){const b=f.box;if(!b||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>1.001||b.y+b.height>1.001||!Array.isArray(f.embedding)||f.embedding.length!==128||!f.embedding.every(Number.isFinite)||Math.abs(Math.hypot(...f.embedding)-1)>0.01)throw Error('Invalid face response');}}
 return v;
}
/** Embeddings are server-only; never serialize this response into an event or public API. */
export async function measureFaces(frames:VisionFrame[],fetcher:typeof fetch=fetch){
 const config=await visionConfig();if(!config.apiKey)throw Error('AutoVision unavailable');
 const r=await fetcher(config.url+'/api/v1/faces',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json'},body:JSON.stringify({frames,classify:false}),redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('Face measurement service unavailable; configure the AutoVision face models');
 const result=validateFaceResult(await r.json());
 if(result.frames.length!==frames.length||result.frames.some((f,i)=>f.at_ms!==frames[i].at_ms))throw Error('Face response timestamps mismatch');
 return result;
}
