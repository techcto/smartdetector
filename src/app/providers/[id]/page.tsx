'use client';
import {use, useEffect, useState} from 'react';
import Link from 'next/link';
type Connection={id:string;name:string;providerKey:string;status:string;settings:Record<string,string>};
export default function ProviderDetail({params}:{params:Promise<{id:string}>}){
  const {id}=use(params),[connection,setConnection]=useState<Connection|null>(null),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();fetch('/api/v1/providers',{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Unable to load connection');const data=await r.json();const found=data.connections.find((c:Connection)=>c.id===id);if(!found)throw new Error('Connection not found in this workspace');setConnection(found)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[id]);
  return <><section className="hero"><Link href="/providers">← Providers</Link><p className="eyebrow">Connection details</p><h1>{connection?.name||'Provider connection'}</h1>{error&&<p role="alert">{error}</p>}</section>{connection?<section className="card g-card"><h2>{connection.providerKey}</h2><p>Status: {connection.status}. Configuration status is not a connectivity test.</p><dl>{Object.entries(connection.settings).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'Not configured'}</dd></div>)}</dl><p className="muted">Secret values are redacted by the server. This connection belongs to your active organization.</p></section>:!error&&<p>Loading connection…</p>}</>;
}
