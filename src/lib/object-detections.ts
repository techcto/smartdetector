export type ObjectDetection={label:string;source:'opencv'|'bedrock';advisory:boolean;score?:number;box:{x:number;y:number;width:number;height:number}};
export function objectDetections(value:unknown):ObjectDetection[]{
 if(!Array.isArray(value))return [];
 return value.slice(0,20).flatMap(v=>{
  if(!v||typeof v!=='object'||typeof v.label!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(v.label))return [];
  const b=v.box??v.bbox;if(!b||![b.x,b.y,b.width,b.height].every(n=>typeof n==='number'&&Number.isFinite(n))||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>1.001||b.y+b.height>1.001)return [];
  if(v.source!==undefined&&!['bedrock','opencv'].includes(v.source))return [];
  const source=v.source==='bedrock'?'bedrock':'opencv';
  return [{label:v.label,source,advisory:source==='bedrock'||v.advisory===true,...(typeof v.score==='number'&&Number.isFinite(v.score)?{score:v.score}:{}),box:{x:b.x,y:b.y,width:Math.min(b.width,1-b.x),height:Math.min(b.height,1-b.y)}} as ObjectDetection];
 });
}
export function detectionFrames(value:unknown){
 if(!Array.isArray(value))return [];
 return value.slice(0,12).flatMap(v=>v&&Number.isFinite(v.at_ms)&&v.at_ms>=0&&v.at_ms<=30000?[{at_ms:v.at_ms,detections:objectDetections(v.detections)}]:[]);
}
