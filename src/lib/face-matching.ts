import type {FaceResult} from './face-service';
import {enrolledPeople} from './people';
import {shouldNotifyPeople,PersonMatch} from './people-policy';
import type {ObjectDetection} from './object-detections';
export function cosine(a:number[],b:number[]){if(a.length!==128||b.length!==128||!a.every(Number.isFinite)||!b.every(Number.isFinite))return -1;const norm=Math.hypot(...a)*Math.hypot(...b);return norm>0?a.reduce((sum,n,i)=>sum+n*b[i],0)/norm:-1;}
type Gallery=Awaited<ReturnType<typeof enrolledPeople>>;
export function matchFaces(result:FaceResult,gallery:Gallery,frames:{at_ms:number;detections:ObjectDetection[]}[],policy:{threshold:number;margin:number;calibrated:boolean}){
 const sightings:{personId:string;version:number;at_ms:number}[]=[],matches:PersonMatch[]=[];
 let completeCoverage=frames.length===result.frames.length&&frames.length>0;
 for(const frame of frames){
  // Only measured OpenCV people count for coverage. Advisory AI boxes cannot certify absence.
  const people=frame.detections.filter(d=>d.label==='person'&&d.source==='opencv'&&!d.advisory),faces=result.frames.find(f=>f.at_ms===frame.at_ms)?.faces??[];
  const covered=new Set<number>();
  const matchedPeople=new Set<string>();
  if(!people.length||faces.length!==people.length)completeCoverage=false;
  for(const face of faces){
   const center={x:face.box.x+face.box.width/2,y:face.box.y+face.box.height/2};
   const containers=people.flatMap((p,i)=>center.x>=p.box.x&&center.x<=p.box.x+p.box.width&&center.y>=p.box.y&&center.y<=p.box.y+p.box.height?[i]:[]);
   if(containers.length!==1||covered.has(containers[0]))completeCoverage=false;else covered.add(containers[0]);
   const ranked=gallery.filter(p=>p.recognize&&p.reference?.modelId===result.model_id).map(p=>({person:p,score:cosine(face.embedding,p.reference!.embedding)})).sort((a,b)=>b.score-a.score);
   const best=ranked[0];
   if(!best||!Number.isFinite(policy.threshold)||policy.threshold<0.6||policy.threshold>1||!Number.isFinite(policy.margin)||policy.margin<0.05||best.score<policy.threshold||best.score-(ranked[1]?.score??-1)<policy.margin){completeCoverage=false;continue;}
   const p=best.person;if(matchedPeople.has(p.id)){completeCoverage=false;continue;}matchedPeople.add(p.id);matches.push({personId:p.id,confidence:'confirmed',preferences:{recognize:p.recognize,notify:p.notify,saveActivity:p.saveActivity,family:p.family}});
   if(p.saveActivity)sightings.push({personId:p.id,version:p.version,at_ms:frame.at_ms});
  }
  if(covered.size!==people.length)completeCoverage=false;
 }
 const otherHazard=frames.some(f=>f.detections.some(d=>d.label!=='person'));
 // Disabled until the operator explicitly validates thresholds on their camera setup.
 const notify=shouldNotifyPeople({matches,completeCoverage:completeCoverage&&policy.calibrated,otherHazard});
 return {sightings,notify,coverageComplete:completeCoverage,calibrated:policy.calibrated};
}
export async function recognizeEvent(org:string,result:FaceResult,frames:{at_ms:number;detections:ObjectDetection[]}[]){return matchFaces(result,await enrolledPeople(org),frames,{threshold:Number(process.env.SMARTDETECTOR_FACE_MATCH_THRESHOLD??0.75),margin:Number(process.env.SMARTDETECTOR_FACE_MATCH_MARGIN??0.1),calibrated:process.env.SMARTDETECTOR_FACE_ALERT_SUPPRESSION==='validated'});}
