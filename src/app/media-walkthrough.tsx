'use client';
import {useRef,useState} from 'react';
import {demoMedia} from '@/lib/demo-media';
import {demoRecording} from '@/lib/public-demo';
type Box={x:number;y:number;width:number;height:number};
export default function MediaWalkthrough({scenario=0,compact=false}:{scenario?:number;compact?:boolean}){
 const index=Number.isInteger(scenario)&&scenario>=0&&scenario<demoMedia.length?scenario:0;
 const media=demoMedia[index],recording=demoRecording(index),result=recording.analysis;
 const video=useRef<HTMLVideoElement>(null),[time,setTime]=useState(0),[started,setStarted]=useState(false),[error,setError]=useState('');
 const analyzed=started&&time>=1.5,notification=started&&time>=4.5;
 const frame=result.frames.reduce((previous,current)=>current.at_ms<=time*1000?current:previous,result.frames[0]);
 async function play(){if(!video.current)return;video.current.currentTime=0;setTime(0);setError('');try{await video.current.play()}catch{setError('Use the video controls to start playback.')}}
 return <section className="sd-media-demo">
  <div className="d-flex justify-content-between flex-wrap gap-2 mb-2"><strong>{media.title}</strong><span className="badge sd-soft-badge">Prerecorded AutoVision demo</span></div>
  <p className="small text-secondary">{media.view}</p>
  <div className="sd-real-media" style={{maxWidth:index===0?340:undefined,marginInline:'auto'}}>
   <video ref={video} controls muted playsInline preload="none" poster={media.image} aria-label={media.title+' sample video'} onPlay={()=>setStarted(true)} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}><source src={media.video} type="video/mp4"/></video>
   {started&&frame?.detections?.slice(0,20).map((d,i)=>{
    const detection=d as {label:string;box?:Box;bbox?:Box;advisory?:boolean},box=detection.box??detection.bbox;
    if(!box||![box.x,box.y,box.width,box.height].every(n=>Number.isFinite(n)&&n>=0&&n<=1))return null;
    return <div key={i} className="sd-detection-box" style={{left:box.x*100+'%',top:box.y*100+'%',width:Math.min(box.width,1-box.x)*100+'%',height:Math.min(box.height,1-box.y)*100+'%'}}><span>{detection.label}{detection.advisory?' · AI advisory':''}</span></div>;
   })}
  </div>
  <p className="small text-secondary mt-2"><a href={media.source} target="_blank" rel="noopener noreferrer">{media.credit} ↗</a> · <a href="https://www.pexels.com/license/">Pexels license</a> · Not Ring footage.</p>
  <button className="btn btn-primary w-100" onClick={()=>void play()}>Play demo event →</button>
  {error&&<p role="alert" className="text-danger mt-2">{error}</p>}
  <ol className={`sd-demo-stages ${compact?'small':''}`} aria-label="Event processing stages">
   <li className={started?'complete':''}><strong>1 / Camera event</strong><span>{started?'Replaying the sample camera-event workflow.':'Press Play on the clip or use Play demo event.'}</span></li>
   <li className={analyzed?'complete':''}><strong>2 / Saved AutoVision results</strong><span>{analyzed?'Showing the recorded analysis for this clip.':'Each sample was analyzed once; playback makes no AI calls.'}</span></li>
   <li className={notification?'complete':''}><strong>3 / Notification preview</strong><span>{notification?'Event ready for human review.':'Preview appears after 4.5 seconds of playback.'}</span></li>
  </ol>
  {analyzed&&<>
   <div className="sd-ai-note mb-3"><strong>Illustrative event context</strong><p className="mb-0">{media.context.replace('Example AI context: ','')}</p><small>This scenario description is scripted, not a Bedrock result.</small></div>
   <div className="table-responsive"><table className="table table-sm small"><thead><tr><th>Recorded observation</th><th>Value</th><th>Detected</th></tr></thead><tbody>{result.observations.map((o,i)=><tr key={i}><td>{o.type}</td><td>{o.value}</td><td>{o.detected?'Yes':'No'}</td></tr>)}</tbody></table></div>
   <p className="small text-secondary">Bedrock status when recorded: {result.classification.status}. Motion/person results do not imply pet or package recognition.</p>
   <details className="small mb-3"><summary>Saved AutoVision JSON</summary><pre>{JSON.stringify(result,null,2)}</pre></details>
  </>}
  {notification&&<div className="alert alert-primary mb-2" role="status"><strong>Demo notification</strong><br/>{media.notification}<small className="d-block mt-1">Preview only—not sent to email, WhatsApp, or a TV.</small></div>}
  <p className="small text-secondary mb-0">Prerecorded sample analysis with a simulated event workflow. No live camera, API call, or account data. Boxes follow sampled frames, not continuous tracking. Recorded {recording.recorded_at.slice(0,10)}.</p>
 </section>;
}
