'use client';
import{useEffect,useState}from'react';
type Product={id:string;name:string;description:string;monthlyPrice:number;serverLimit:number;extraDeviceMonthlyPrice?:number;available:boolean};
export default function BillingConsole(){
 const[products,setProducts]=useState<Product[]>([]),[currentPlanId,setCurrentPlanId]=useState<string|null>(null),[error,setError]=useState('');
 const[acceptDeviceBilling,setAcceptDeviceBilling]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/v1/products').then(x=>x.json()).then(data=>{if(active)setProducts(data)});return()=>{active=false}},[]);
 useEffect(()=>{let active=true;fetch('/api/v1/billing/plan').then(r=>r.ok?r.json():null).then(data=>{if(active&&data)setCurrentPlanId(data.productId)});return()=>{active=false}},[]);
 async function portal(){setError('');const r=await fetch('/api/billing/portal',{method:'POST'}),v=await r.json();if(r.ok)window.location.assign(v.url);else setError(v.error)}
 async function checkout(id:string){setError('');setBusy(true);try{const r=await fetch('/api/billing/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:id,acceptDeviceBilling})}),data=await r.json();if(!r.ok){setError(data.error);return}window.location.assign(data.url)}catch{setError('Unable to start checkout. Please try again.')}finally{setBusy(false)}}
 return <><button className="btn btn-outline-primary mb-4" onClick={portal}>Manage subscription</button>{error&&<div className="notice"><strong>Billing unavailable</strong><span>{error}</span></div>}<label className="d-block mb-4"><input type="checkbox" checked={acceptDeviceBilling} onChange={event=>setAcceptDeviceBilling(event.target.checked)}/> I agree that paid plans automatically bill additional registered devices at $2/device/month. Additions and removals are prorated on the next invoice. Offline devices and Fire TV displays count until removed.</label><section className="grid">{products.map(p=>{const isCurrent=p.id===currentPlanId;return <article className="card g-card price-card" key={p.id}><div className="eyebrow">{p.name}</div><div className="price"><strong>${p.monthlyPrice}</strong><span>/month</span></div><p className="muted">{p.description}</p><p>{p.serverLimit} device{p.serverLimit===1?'':'s'} included</p>{p.extraDeviceMonthlyPrice&&<p>${p.extraDeviceMonthlyPrice} per additional device/month</p>}{isCurrent?<button className="btn button btn-light" disabled>Current plan</button>:p.monthlyPrice===0?<button className="btn button btn-light" disabled>Included</button>:<button className="btn button primary btn-primary" disabled={busy||!acceptDeviceBilling||!p.available} onClick={()=>checkout(p.id)}>Upgrade</button>}</article>})}</section></>
}



