import {objectDetections} from '@/lib/object-detections';
export default function DetectionImage({src,alt,detections,compact=false}:{src:string;alt:string;detections?:unknown;compact?:boolean}){
 const boxes=objectDetections(detections);
 return <div className={'detection-image'+(compact?' detection-image-compact':'')}><img src={src} alt={alt}/>{boxes.length>0&&<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label={boxes.map(d=>d.label+(d.advisory?' (AI advisory)':'')).join(', ')}>{boxes.map((d,i)=><g key={i} className={d.advisory?'detection-advisory':'detection-measured'}><rect x={d.box.x*1000} y={d.box.y*1000} width={d.box.width*1000} height={d.box.height*1000} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2.5}/><text x={d.box.x*1000+4} y={Math.max(25,d.box.y*1000-8)} fontSize={compact?32:24} paintOrder="stroke" stroke="#10243b" strokeWidth="4" fill="white">{d.label}{d.advisory?' · AI advisory':''}</text></g>)}</svg>}</div>;
}
