'use client';
import {useState} from 'react';
import Drawer,{DrawerBackdrop} from '../drawer';
export default function RemoveDevice({device,onRemoved}:{device:{serverId:string;displayName:string};onRemoved:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=()=>{if(!busy){setOpen(false);setConfirmation('');setError('');}};
 async function remove(){
  if(confirmation!=='DELETE'||busy)return;
  setBusy(true);setError('');
  try{const r=await fetch('/api/v1/devices/'+encodeURIComponent(device.serverId),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:device.serverId,confirmation})});if(!r.ok)throw Error((await r.json()).error||'Unable to remove device');await onRemoved();setOpen(false);setConfirmation('');}catch(e){setError(e instanceof Error?e.message:'Unable to remove device');}finally{setBusy(false);}
 }
 return <><button type="button" className="device-trash" aria-label={`Remove ${device.displayName}`} title={`Remove ${device.displayName}`} onClick={()=>setOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button><DrawerBackdrop open={open} onClose={close}/><Drawer open={open} onClose={close} title="Remove device"><h3 className="h5">Remove {device.displayName}?</h3><p>This permanently removes this device and its saved events and images from this location. Other devices and the Ring account connection are kept. Removing a Fire TV display also revokes its access. Ring recordings and backups are not deleted.</p><p className="text-danger">This cannot be undone. To keep camera history, remove its Ring connection instead.</p><label className="form-label" htmlFor={`remove-${device.serverId}`}>Type DELETE to confirm</label><input id={`remove-${device.serverId}`} className="form-control mb-3" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/>{error&&<p className="alert alert-danger" role="alert">{error}</p>}<button type="button" className="btn btn-danger" disabled={busy||confirmation!=='DELETE'} onClick={()=>void remove()}>{busy?'Removing…':'Remove device and history'}</button></Drawer></>;
}
