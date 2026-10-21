'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { eventView } from '@/lib/event-view';
import DeviceFeed from './device-feed';
import type {FeedDevice} from '@/lib/device-feed';
type Device = FeedDevice;
type Event = { incidentId: string; serverId: string; state: string; startedAt: string; payload: unknown };
export default function Console({historyOnly=false}:{historyOnly?:boolean}) {
  const [devices, setDevices] = useState<Device[]>([]), [events, setEvents] = useState<Event[]>([]), [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
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
  return <>
    {!historyOnly&&<DeviceFeed devices={devices} events={events} loaded={loaded}/>}
    <section className="card g-card"><div className="section-heading"><div><h2>Recent events</h2><p className="muted">Up to 50 events in this workspace · refreshes every five seconds</p></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="table-wrap"><table className="table align-middle mb-0"><thead><tr><th>Observation</th><th>Device</th><th>Source</th><th>Time</th><th>Status</th></tr></thead><tbody>{events.map(event => {
        const view = eventView(event.payload), href = `/events/${encodeURIComponent(event.incidentId)}`;
        return <tr key={event.incidentId}><td><Link className="event-link" href={href}>{view.preview ? <Image className="event-thumbnail" src={view.preview} alt="Event preview" width={76} height={56} unoptimized/> : <span className="event-placeholder" aria-hidden="true">◈</span>}<span><strong>{view.kind}</strong><small className="muted">{view.synthetic ? 'Synthetic demonstration' : 'View details →'}</small></span></Link></td><td>{devices.find(d => d.serverId === event.serverId)?.displayName ?? event.serverId}</td><td>{view.source}</td><td>{new Date(event.startedAt).toLocaleString()}</td><td><span className="status">{event.state}</span></td></tr>;
      })}{!events.length && <tr><td colSpan={5} className="empty-state"><strong>{loaded ? 'No events yet' : 'Loading events…'}</strong><span>Connect a device to receive events. For localhost camera testing, use Ring Playground in Connect provider.</span></td></tr>}</tbody></table></div>
    </section>
  </>;
}
