'use client';
import {FormEvent, useEffect, useState} from 'react';
import Drawer, {DrawerBackdrop} from '@/app/drawer';

type OrgSummary={id:string;name:string;orgType:'personal'|'business';role:string};
type CreatedOrg={id:string;name:string;enrollmentToken:string};

export default function OrganizationsConsole(){
  const [orgs,setOrgs]=useState<OrgSummary[]>([]),[open,setOpen]=useState(false),[error,setError]=useState('');
  const [created,setCreated]=useState<CreatedOrg|null>(null),[copied,setCopied]=useState(false);
  function load(){fetch('/api/orgs').then(r=>r.ok?r.json():[]).then(setOrgs)}
  useEffect(()=>{load()},[]);
  async function add(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const r=await fetch('/api/orgs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:f.get('name'),contactEmail:f.get('contactEmail'),contactPhone:f.get('contactPhone')})});
    if(!r.ok){setError((await r.json()).error??'Unable to create location');return}
    const org=await r.json();
    setError('');setCreated(org);load();
  }
  async function switchTo(orgId:string){
    const r=await fetch('/api/orgs/active',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orgId})});
    if(r.ok)window.location.assign('/console');
  }
  function closeDrawer(){setOpen(false);setCreated(null);setError('')}
  return <>
    <div className="section-heading"><div><h2>Locations</h2><p className="muted">Each location has its own devices, events, and enrollment token.</p></div><button className="btn button primary btn-primary" onClick={()=>setOpen(true)}>Add location</button></div>
    <div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody>
      {orgs.length?orgs.map(o=><tr key={o.id} className="row-link" onClick={()=>switchTo(o.id)}><td><strong>{o.name}</strong></td><td className="muted">{o.orgType}</td></tr>)
      :<tr><td colSpan={2} className="empty-state"><strong>No locations yet.</strong><span>Add one to get its enrollment token.</span></td></tr>}
    </tbody></table></div>
    <DrawerBackdrop open={open} onClose={closeDrawer}/>
    <Drawer open={open} title="Add location" onClose={closeDrawer}>
      {created?<>
        <p className="muted">&quot;{created.name}&quot; is ready. Copy its enrollment token now — it won&apos;t be shown again here.</p>
        <pre><code>{created.enrollmentToken}</code></pre>
        <button className="btn button primary btn-primary" onClick={async()=>{await navigator.clipboard.writeText(created.enrollmentToken);setCopied(true);setTimeout(()=>setCopied(false),1600)}}>{copied?'Copied':'Copy token'}</button>
      </>:<form className="drawer-form" onSubmit={add}>
        <label>Location name<input className="form-control" name="name" required autoFocus/></label>
        <label>Contact email<input className="form-control" name="contactEmail" type="email"/></label>
        <label>Contact phone<input className="form-control" name="contactPhone" type="tel"/></label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="btn button primary btn-primary" type="submit">Create</button>
      </form>}
    </Drawer>
  </>;
}

