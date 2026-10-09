'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { eventView } from '@/lib/event-view';
type Event = { incidentId: string; serverId: string; state: string; startedAt: string; updatedAt: string; payload: unknown };
export default function EventDetail({ id }: { id: string }) {
  const [event, setEvent] = useState<Event | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/incidents/${encodeURIComponent(id)}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'Event not found in this workspace.' : 'Unable to load event. Check your access and try again.');
      const data = await response.json();
      if (!controller.signal.aborted) { setEvent(data); setError(''); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id]);
  if (!event || event.incidentId !== id) return <><section className="hero"><Link href="/">← Recent events</Link><h1>{error ? 'Event unavailable' : 'Loading event…'}</h1>{error && <p role="alert">{error}</p>}</section></>;
  const view = eventView(event.payload);
  return <><section className="hero"><Link href="/">← Recent events</Link><p className="eyebrow">Event review</p><h1>{view.kind}</h1><p className="muted">{new Date(event.startedAt).toLocaleString()} · {view.source} · {event.serverId}</p><span className="status">{event.state}</span>{view.synthetic && <span className="tag-pill">Synthetic demonstration</span>}</section>
    <div className="event-detail-grid"><section className="g-card"><h2>Visual evidence</h2>{view.preview ? <Image className="event-large-preview" src={view.preview} alt="Recorded event thumbnail" width={960} height={540} unoptimized/> : <div className="event-no-media"><strong>No visual preview</strong><p>This event contains sensor readings or has no retained thumbnail.</p></div>}<p className="muted small">No recorded video is retained for this event. A thumbnail is a single observation, not a complete recording.</p></section>
      <section className="g-card"><h2>Assessment</h2><p>{view.assessment || 'Review the recorded observations before deciding what action to take.'}</p>{view.signalValue !== null && <p><strong>Recorded reading:</strong> {view.signalValue}</p>}{view.aiSummary && <><h3>AI context</h3><p>{view.aiSummary}</p><p className="muted small">Advisory interpretation, not a confirmed emergency or intruder determination.</p></>}{view.classificationStatus && <p className="muted">Classification: {view.classificationStatus}</p>}<h3>Event information</h3><dl><dt>Event ID</dt><dd className="event-id">{event.incidentId}</dd><dt>Updated</dt><dd>{new Date(event.updatedAt).toLocaleString()}</dd>{view.autoVisionJobId && <><dt>AutoVision job</dt><dd className="event-id">{view.autoVisionJobId}</dd></>}</dl></section></div>
    {view.observations.length > 0 && <section className="g-card event-device-section"><h2>Recorded observations</h2><div className="table-wrap"><table><thead><tr><th>Type</th><th>Value</th><th>Detected</th><th>Interpretation</th></tr></thead><tbody>{view.observations.map((o, i) => <tr key={i}><td>{o.type}</td><td>{o.value ?? '—'}</td><td>{o.detected ? 'Yes' : 'No'}</td><td>{o.advisory ? 'Advisory' : 'Detector output'}</td></tr>)}</tbody></table></div></section>}
    <details className="g-card event-device-section"><summary>Raw event JSON</summary><pre>{JSON.stringify(event, null, 2)}</pre></details>
  </>;
}
