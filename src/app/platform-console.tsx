'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Drawer, { DrawerBackdrop } from './drawer';
import { eventView } from '@/lib/event-view';
import DeviceFeed from './device-feed';
import type {FeedDevice} from '@/lib/device-feed';
type Device = FeedDevice;
type Event = { incidentId: string; serverId: string; state: string; startedAt: string; payload: unknown };
export default function Console({historyOnly=false}:{historyOnly?:boolean}) {
  const [devices, setDevices] = useState<Device[]>([]), [events, setEvents] = useState<Event[]>([]), [error, setError] = useState(''), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true, pending = false;
    const controller = new AbortController();
    async function load() {
      if (pending) return; pending = true;
      try {
        const responses = await Promise.all([fetch('/api/v1/devices', { signal: controller.signal }), fetch('/api/v1/incidents', { signal: controller.signal })]);
        if (responses.some(r => !r.ok)) throw new Error('Unable to read this workspace. Check your session and organization.');
        const [d, e] = await Promise.all(responses.map(r => r.json()));
        if (active) { setDevices(d); setEvents(e); setError(''); setLoaded(true); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Unable to refresh events'); } finally { pending = false; }
    }
    void load(); const timer = setInterval(() => void load(), 5000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, []);
  async function simulate() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/v1/simulator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device_id: 'demo-sensor', type: 'smoke', value: 80 }) });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Simulation failed');
      setOpen(false);
      const refreshed = await fetch('/api/v1/incidents'); if (refreshed.ok) setEvents(await refreshed.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Simulation failed'); } finally { setBusy(false); }
  }
  return <>
    {!historyOnly&&<><DeviceFeed devices={devices} events={events} loaded={loaded}/>
    <div className="grid event-metrics"><section className="card g-card"><span className="muted">Devices shown</span><div className="metric">{devices.length}</div></section><section className="card g-card"><span className="muted">Events shown</span><div className="metric">{events.length}</div></section><section className="card g-card"><span className="muted">Awaiting review</span><div className="metric">{events.filter(e => e.state === 'review').length}</div></section></div></>}
    <section className="card g-card"><div className="section-heading"><div><h2>Recent events</h2><p className="muted">Up to 50 events in this workspace · refreshes every five seconds</p></div><button className="btn button primary btn-primary" onClick={() => setOpen(true)}>Run simulation</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>Observation</th><th>Device</th><th>Source</th><th>Time</th><th>Status</th></tr></thead><tbody>{events.map(event => {
        const view = eventView(event.payload), href = `/events/${encodeURIComponent(event.incidentId)}`;
        return <tr key={event.incidentId}><td><Link className="event-link" href={href}>{view.preview ? <Image className="event-thumbnail" src={view.preview} alt="Event preview" width={76} height={56} unoptimized/> : <span className="event-placeholder" aria-hidden="true">◈</span>}<span><strong>{view.kind}</strong><small className="muted">{view.synthetic ? 'Synthetic demonstration' : 'View details →'}</small></span></Link></td><td>{devices.find(d => d.serverId === event.serverId)?.displayName ?? event.serverId}</td><td>{view.source}</td><td>{new Date(event.startedAt).toLocaleString()}</td><td><span className="status">{event.state}</span></td></tr>;
      })}{!events.length && <tr><td colSpan={5} className="empty-state"><strong>{loaded ? 'No events yet' : 'Loading events…'}</strong><span>Connect a device or run an explicitly synthetic sensor simulation.</span></td></tr>}</tbody></table></div>
    </section>
    {!historyOnly&&<section className="card g-card event-device-section"><div className="section-heading"><h2>Connected devices</h2><Link href="/devices">Manage devices →</Link></div><div className="grid">{devices.map(device => <article key={device.serverId}><strong>{device.displayName}</strong><p><span className="status neutral">{device.status}</span></p><small className="muted">Last signal: {new Date(device.lastHeartbeat).toLocaleString()}</small></article>)}{!devices.length && <p className="muted">No devices have reported observations in this workspace.</p>}</div></section>}
    <DrawerBackdrop open={open} onClose={() => setOpen(false)}/><Drawer open={open} title="Run sensor simulation" onClose={() => setOpen(false)}><p>Create a clearly labeled synthetic smoke reading of 80. This exercises the demonstration threshold; it is not a real smoke detector or emergency alert.</p><p className="muted">Configured notification workflows may run. Only operators and administrators can submit simulations.</p>{error && <p role="alert" className="form-error">{error}</p>}<button className="btn button primary btn-primary" disabled={busy} onClick={() => void simulate()}>{busy ? 'Submitting…' : 'Create synthetic event'}</button></Drawer>
  </>;
}
