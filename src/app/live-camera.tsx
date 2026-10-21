'use client';
import {useEffect,useRef,useState} from 'react';
export default function LiveCamera({id,token}:{id:string;token?:string}){
 const video=useRef<HTMLVideoElement>(null),peer=useRef<RTCPeerConnection|null>(null),ticket=useRef(''),timer=useRef<ReturnType<typeof setTimeout>|null>(null),[message,setMessage]=useState('Select Start live view to connect. Video only; audio is off.'),[busy,setBusy]=useState(false),[active,setActive]=useState(false);
 const [playground,setPlayground]=useState(false),[analyzing,setAnalyzing]=useState(false),[analysisMessage,setAnalysisMessage]=useState(''),[poster,setPoster]=useState('');
 const mounted=useRef(true),analysisLock=useRef(false);
 function imageFrame(){const v=video.current;if(!v||v.readyState<2||!v.videoWidth)return '';const canvas=document.createElement('canvas');canvas.width=640;canvas.height=Math.min(640,Math.max(1,Math.round(640*v.videoHeight/v.videoWidth)));const c=canvas.getContext('2d');if(!c)return '';c.drawImage(v,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.75);}
 useEffect(()=>{const c=new AbortController();if(!token)void fetch('/api/v1/devices/'+encodeURIComponent(id)+'/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview'}),signal:c.signal}).then(r=>r.ok?r.json():null).then(v=>{if(!c.signal.aborted&&v?.image)setPoster(v.image);}).catch(()=>{});return()=>c.abort();},[id,token]);
 useEffect(()=>{if(token||!['localhost','127.0.0.1','[::1]'].includes(window.location.hostname))return;const c=new AbortController();void fetch('/api/local/ring-playground/analyze?deviceId='+encodeURIComponent(id),{cache:'no-store',signal:c.signal}).then(r=>setPlayground(r.ok)).catch(()=>{});return()=>c.abort();},[id,token]);
 async function analyze(){
  if(analysisLock.current||busy)return;analysisLock.current=true;setAnalyzing(true);setAnalysisMessage('Connecting for a seven-second sample…');
  let session='',pc:RTCPeerConnection|null=null;
  try{
   if(!await start())throw Error('Unable to connect. Check the Playground token and try again.');
   session=ticket.current;pc=peer.current;
   const deadline=Date.now()+12000;
   while(Date.now()<deadline){const v=video.current;if(!mounted.current||peer.current!==pc||ticket.current!==session)throw Error('Sampling cancelled');if(v&&v.readyState>=2&&v.videoWidth&&!v.paused)break;await new Promise(r=>setTimeout(r,100));}
   const frames=[];
   for(let i=0;i<8;i++){
    if(i)await new Promise(resolve=>setTimeout(resolve,1000));
    const v=video.current;
    if(!mounted.current||!session||ticket.current!==session||peer.current!==pc)throw Error('Sampling cancelled');
    if(!v||v.readyState<2||!v.videoWidth||v.paused)throw Error('No playable Ring video received. Check live-view connectivity and try again.');
    const image=imageFrame();if(!image)throw Error('Video sampling unavailable');setPoster(image);
    frames.push({image:image.split(',')[1],at_ms:i*1000});setAnalysisMessage('Captured '+(i+1)+' of 8 frames…');
   }
   // Stop media immediately after sampling; inference need not keep streaming.
   await stop();setMessage('Sample captured · showing the last image, not live.');
   setAnalysisMessage('AutoVision is analyzing the sampled footage…');
   const r=await fetch('/api/local/ring-playground/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:id,ticket:session,frames}),signal:AbortSignal.timeout(100000)}),result=await r.json();
   if(!r.ok)throw Error(result.error);if(mounted.current)setAnalysisMessage('Analysis saved. Open History or your paired TV to review the Playground event.');
  }catch(e){if(mounted.current)setAnalysisMessage(e instanceof Error?e.message:'Analysis unavailable');}finally{if(session&&ticket.current===session)await stop();analysisLock.current=false;if(mounted.current)setAnalyzing(false);}
 }
 const endpoint='/api/v1/devices/'+encodeURIComponent(id)+'/media';
 async function stop(){try{const image=imageFrame();if(image&&mounted.current)setPoster(image);}catch{/* Keep the previous preview if sampling is unavailable. */}if(timer.current)clearTimeout(timer.current);peer.current?.close();peer.current=null;if(video.current){video.current.srcObject=null;video.current.load();}setActive(false);const t=ticket.current;ticket.current='';if(t)await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'stop',ticket:t}),keepalive:true}).catch(()=>{});}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);peer.current?.close();peer.current=null;if(ticket.current)void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'stop',ticket:ticket.current}),keepalive:true}).catch(()=>{});};},[endpoint,token]);
 async function start(){setBusy(true);setMessage('Connecting to camera…');try{
  await stop();const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});peer.current=pc;pc.addTransceiver('video',{direction:'recvonly'});
  pc.ontrack=e=>{if(video.current){video.current.srcObject=e.streams[0]??new MediaStream([e.track]);void video.current.play().catch(()=>setMessage('Select Play on the video to begin viewing.'));}setMessage('Live video · session limited to 30 seconds');};
  await pc.setLocalDescription(await pc.createOffer());
  // Hosts with many interfaces (Docker bridges, VPNs) can keep gathering for ~40s; offer once a public (srflx) candidate exists.
  await new Promise<void>(resolve=>{if(pc.iceGatheringState==='complete')return resolve();let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timeout);pc.onicegatheringstatechange=null;pc.onicecandidate=null;resolve();};const timeout=setTimeout(finish,5000);pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete')finish();};pc.onicecandidate=e=>{if(e.candidate?.type==='srflx')setTimeout(finish,250);};});
  if(peer.current!==pc)throw Error('Live view closed');
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'live',sdp:pc.localDescription?.sdp}),signal:AbortSignal.timeout(25000)}),v=await r.json();if(!r.ok)throw Error(v.error);ticket.current=v.ticket;if(peer.current!==pc){await stop();return false}await pc.setRemoteDescription({type:'answer',sdp:v.sdp});setActive(true);timer.current=setTimeout(()=>{void stop();setMessage('Session ended. Start again to reconnect.');},Math.min(30,Math.max(1,Number(v.maxSeconds)||30))*1000);return true;
 }catch(e){await stop();setMessage(e instanceof Error?e.message:'Unable to start live view');return false;}finally{setBusy(false)}}
 return <section className="card g-card vstack gap-3"><h2>Camera live view</h2><p>Video only. Sessions end after 30 seconds. Ring may record sessions according to device settings.</p><video poster={poster||undefined} ref={video} controls autoPlay muted playsInline style={{width:'100%',maxHeight:'65vh',background:'#10243b',borderRadius:12}}/>{!active&&<p className="small text-muted mb-0">{poster?'Last available image · not live':'No previous image available yet. Start live view or analyze footage to capture one.'}</p>}<p role="status">{message}</p><div className="d-flex gap-3"><button className="btn btn-primary" disabled={busy||active||analyzing} onClick={()=>void start()}>{busy?'Connecting…':'Start live view'}</button><button className="btn btn-outline-danger" disabled={!active} onClick={()=>{void stop();setMessage('Live view stopped.')}}>Stop</button></div>{playground&&<div className="border-top pt-3"><button className="btn btn-outline-primary" disabled={busy||analyzing} onClick={()=>void analyze()}>{analyzing?'Analyzing…':'Analyze Playground footage'}</button><p className="small text-muted mt-2 mb-0">Local test: automatically connects, captures eight frames over seven seconds, then stops video and analyzes using the normal AutoVision, history and TV pipeline. Not a Ring motion webhook. Real analysis may incur charges.</p><p role="status">{analysisMessage}</p></div>}</section>;
}

