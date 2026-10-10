'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DetectionImage from '../../detection-image';
import { eventView } from '@/lib/event-view';
type Event = { incidentId: string; serverId: string; state: string; startedAt: string; updatedAt: string; payload: unknown };
export default function EventDetail({ id,returnDevice }: { id: string;returnDevice?:string }) {
  const [frame,setFrame]=useState(0);
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
  if (!event || event.incidentId !== id) return <><section className="hero"><Link href="/events">← History</Link><h1>{error ? 'Event unavailable' : 'Loading event…'}</h1>{error && <p role="alert">{error}</p>}</section></>;
  const view = eventView(event.payload);
  return <><section className="hero"><div className="d-flex flex-wrap gap-3"><Link href={returnDevice===event.serverId?'/devices/'+encodeURIComponent(event.serverId):'/events'}>{returnDevice===event.serverId?'← Back to device':'← History'}</Link><Link href="/console">Dashboard</Link><Link href={'/devices/'+encodeURIComponent(event.serverId)}>View device</Link></div><p className="eyebrow mt-3">Event review</p><h1>{view.kind}</h1><p className="muted">{new Date(event.startedAt).toLocaleString()} · {view.source} · {event.serverId}</p><span className="status">{event.state}</span>{view.synthetic && <span className="tag-pill">Synthetic demonstration</span>}</section>
    <div className="event-detail-grid"><section className="card g-card"><h2>Visual evidence</h2>{view.preview ? <DetectionImage src={view.evidenceFrames[frame]?.preview??view.preview} alt="Recorded event frame" detections={view.evidenceFrames[frame]?.detections}/> : <div className="event-no-media"><strong>No visual preview</strong><p>This event contains sensor readings or has no retained thumbnail.</p></div>}{view.evidenceFrames.length>0&&<div className="d-flex flex-wrap gap-2 my-3" aria-label="Sampled frames">{view.evidenceFrames.map((f,i)=><button key={i} className={'btn p-1 '+(frame===i?'btn-primary':'btn-outline-primary')} onClick={()=>setFrame(i)} aria-pressed={frame===i} aria-label={'Show frame '+(i+1)}><img src={f.preview} alt="" width={96} height={54} style={{objectFit:'contain'}}/><span className="d-block small">{(f.at_ms/1000).toFixed(1)}s</span></button>)}</div>}<p className="small">{view.evidenceFrames[frame]?.detections.length??0} object boxes in this frame. Green: detector output. Dashed amber: advisory AI grounding. Scores are not calibrated probabilities.</p><p className="muted small">{view.evidenceFrames.length} retained sampled frames. No original video is retained. Sampling can miss activity between frames.</p></section>
      <section className="card g-card"><h2>Assessment</h2><p>{view.assessment || 'Review the recorded observations before deciding what action to take.'}</p>{view.signalValue !== null && <p><strong>Recorded reading:</strong> {view.signalValue}</p>}{view.aiSummary && <><h3>AI context</h3><p>{view.aiSummary}</p><p className="muted small">Advisory interpretation, not a confirmed emergency or intruder determination.</p></>}{view.classificationStatus && <p className="muted">Classification: {view.classificationStatus}</p>}<h3>Event information</h3><dl><dt>Event ID</dt><dd className="event-id">{event.incidentId}</dd><dt>Updated</dt><dd>{new Date(event.updatedAt).toLocaleString()}</dd>{view.autoVisionJobId && <><dt>AutoVision job</dt><dd className="event-id">{view.autoVisionJobId}</dd></>}</dl></section></div>
    {view.observations.length > 0 && <section className="card g-card event-device-section"><h2>Recorded observations</h2><div className="table-wrap"><table><thead><tr><th>Type</th><th>Value</th><th>Detected</th><th>Interpretation</th></tr></thead><tbody>{view.observations.map((o, i) => <tr key={i}><td>{o.type}</td><td>{o.value ?? '—'}</td><td>{o.detected ? 'Yes' : 'No'}</td><td>{o.advisory ? 'Advisory' : 'Detector output'}</td></tr>)}</tbody></table></div></section>}
    <details className="card g-card event-device-section"><summary>Raw event JSON</summary><pre>{JSON.stringify(event, null, 2)}</pre></details>
  </>;
}
