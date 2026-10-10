'use client';
import {useEffect,useRef,useState} from 'react';
export default function LiveCamera({id,token}:{id:string;token?:string}){
 const video=useRef<HTMLVideoElement>(null),peer=useRef<RTCPeerConnection|null>(null),ticket=useRef(''),timer=useRef<ReturnType<typeof setTimeout>|null>(null),[message,setMessage]=useState('Select Start live view to connect. Video only; audio is off.'),[busy,setBusy]=useState(false),[active,setActive]=useState(false);
 const endpoint='/api/v1/devices/'+encodeURIComponent(id)+'/media';
 async function stop(){if(timer.current)clearTimeout(timer.current);peer.current?.close();peer.current=null;if(video.current)video.current.srcObject=null;setActive(false);const t=ticket.current;ticket.current='';if(t)await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'stop',ticket:t}),keepalive:true}).catch(()=>{});}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);peer.current?.close();peer.current=null;if(ticket.current)void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'stop',ticket:ticket.current}),keepalive:true}).catch(()=>{});},[endpoint,token]);
 async function start(){setBusy(true);setMessage('Connecting to camera…');try{
  await stop();const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});peer.current=pc;pc.addTransceiver('video',{direction:'recvonly'});
  pc.ontrack=e=>{if(video.current){video.current.srcObject=e.streams[0]??new MediaStream([e.track]);void video.current.play().catch(()=>setMessage('Select Play on the video to begin viewing.'));}setMessage('Live video · session limited to 30 seconds');};
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise<void>((resolve,reject)=>{if(pc.iceGatheringState==='complete')return resolve();const timeout=setTimeout(()=>{pc.onicegatheringstatechange=null;reject(Error('Network negotiation timed out'))},10000);pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timeout);pc.onicegatheringstatechange=null;resolve();}};});
  if(peer.current!==pc)throw Error('Live view closed');
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'live',sdp:pc.localDescription?.sdp}),signal:AbortSignal.timeout(25000)}),v=await r.json();if(!r.ok)throw Error(v.error);ticket.current=v.ticket;if(peer.current!==pc){await stop();return}await pc.setRemoteDescription({type:'answer',sdp:v.sdp});setActive(true);timer.current=setTimeout(()=>{void stop();setMessage('Session ended. Start again to reconnect.');},30000);
 }catch(e){await stop();setMessage(e instanceof Error?e.message:'Unable to start live view')}finally{setBusy(false)}}
 return <section className="card g-card vstack gap-3"><h2>Camera live view</h2><p>Video only. Sessions end after 30 seconds. Ring may record sessions according to device settings.</p><video ref={video} controls autoPlay muted playsInline style={{width:'100%',maxHeight:'65vh',background:'#10243b',borderRadius:12}}/><p role="status">{message}</p><div className="d-flex gap-3"><button className="btn btn-primary" disabled={busy||active} onClick={()=>void start()}>{busy?'Connecting…':'Start live view'}</button><button className="btn btn-outline-danger" disabled={!active} onClick={()=>{void stop();setMessage('Live view stopped.')}}>Stop</button></div></section>;
}

