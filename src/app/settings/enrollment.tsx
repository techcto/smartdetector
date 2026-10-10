'use client';
import {useState} from 'react';
export default function Enrollment(){
 const [key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
 async function reveal(){setBusy(true);setError('');try{const r=await fetch('/api/v1/enrollment'),v=await r.json();if(!r.ok)throw Error(v.error||'Unable to retrieve credential');setKey(v.tenantId+'.device-id.'+v.enrollmentToken)}catch(e){setError(e instanceof Error?e.message:'Connection unavailable')}finally{setBusy(false)}}
 async function copy(){try{await navigator.clipboard.writeText(key);setCopied(true)}catch{setError('Clipboard unavailable. Select and copy the credential above.')}}
 return <section className="card g-card"><div className="vstack gap-3"><div><h2 className="h4">Signal API</h2><p className="muted mb-0">POST JSON to <code>/api/v1/signals</code> using a workspace enrollment credential. Replace device-id with a stable device identifier. Keep the credential private.</p></div><button className="btn btn-outline-primary align-self-start" disabled={busy} onClick={()=>void reveal()}>{busy?'Loading…':'Reveal connection credential'}</button>{key&&<><pre className="mb-0">{key}</pre><div className="d-flex flex-wrap gap-2"><button className="btn btn-outline-primary" onClick={()=>void copy()}>{copied?'Copied':'Copy'}</button><button className="btn btn-light" onClick={()=>{setKey('');setCopied(false)}}>Hide credential</button></div></>}{error&&<div className="alert alert-danger mb-0" role="alert">{error}</div>}</div></section>;
}

