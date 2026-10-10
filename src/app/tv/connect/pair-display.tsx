'use client';
import {useState} from 'react';
import Link from 'next/link';

export default function PairDisplay({onConnected}:{onConnected?:()=>void}) {
  const [code,setCode]=useState(''),[pair,setPair]=useState<{name:string;orgId:string;orgName:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[connected,setConnected]=useState(false);
  async function request(approve=false) {
    setBusy(true);setError('');
    try {
      const response=await fetch(approve?'/api/v1/tv/approve':'/api/v1/tv/approve?code='+encodeURIComponent(code),approve?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,orgId:pair?.orgId})}:{cache:'no-store'});
      const value=await response.json();
      if(!response.ok)throw new Error(value.error||'Unable to connect display');
      if(approve){setConnected(true);setPair(null);onConnected?.();}else setPair(value);
    }catch(e){setError(e instanceof Error?e.message:'Unable to connect display');}finally{setBusy(false);}
  }
  return <div className="vstack gap-4">
    <div><h3 className="h5">Before you connect</h3><p>Have your TV and a phone or computer ready. Only a location administrator can approve a display.</p>
      <ol className="ps-3 mb-0">
        <li className="mb-2">Open SmartDetector on your Fire TV. For a browser test, <Link href="/tv" target="_blank" rel="noopener noreferrer">open the TV display in a new tab ↗</Link>. This preview is not an Appstore installation or a substitute for a real Fire TV test.</li>
        <li className="mb-2">On the display, select <strong>Get pairing code</strong>. Keep that screen open; the code expires in ten minutes.</li>
        <li>Enter the code below, check the TV name and location, then approve. Your TV will update automatically.</li>
      </ol>
    </div>
    {connected?<div className="alert alert-success mb-0" role="status"><strong>TV connected.</strong> Return to your display to see the event feed. <Link href="/devices/integrations/firetv">View Fire TV connections →</Link></div>:<>
      <form className="vstack gap-3" onSubmit={e=>{e.preventDefault();void request();}}>
        <label htmlFor="pair-display-code" className="form-label mb-0">Code shown on your TV</label>
        <input id="pair-display-code" className="form-control form-control-lg font-monospace" placeholder="XXXX-XXXX" autoComplete="off" maxLength={11} required disabled={busy} value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setPair(null);setError('');}}/>
        <button className="btn btn-primary" disabled={busy||!code.trim()}>{busy?'Please wait…':'Check code'}</button>
      </form>
      {pair&&<section className="border rounded-3 p-3 vstack gap-3"><h3 className="h5 mb-0">Connect {pair.name}?</h3><p className="mb-0">Location: <strong>{pair.orgName}</strong></p><p className="mb-0">Read-only access to this location’s event summaries and previews for 24 hours. This display cannot change devices or alarms. Approve only a code on your own screen.</p><button className="btn btn-primary" disabled={busy} onClick={()=>void request(true)}>{busy?'Connecting…':'Connect this TV'}</button></section>}
    </>}
    {error&&<div className="alert alert-warning mb-0" role="alert">{error}</div>}
    <div className="small text-muted"><p>No code? Open the display link above and select Get pairing code. If a code expires, request a new one on the display. To use a different location, close this panel and switch locations before checking the code.</p><p className="mb-0">No API key, application ID, or account password is needed on the TV. To revoke access later: Devices → Fire TV → View connection → Disconnect display. You can also <Link href="/tv/connect">open the standalone pairing page</Link>.</p></div>
  </div>;
}
