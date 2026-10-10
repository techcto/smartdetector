import {NextRequest, NextResponse} from "next/server";
import {authorizeTv} from "@/lib/tv";
import {store} from "@/lib/store";
import {eventView} from '@/lib/event-view';
export async function GET(req: NextRequest) {
  const auth = await authorizeTv(req.headers.get("authorization")?.replace(/^Bearer /, "") || "");
  if (!auth) return NextResponse.json({error: "Display access expired or revoked"}, {status: 401});
  const display=await store.node(auth.orgId,'firetv-'+auth.connectionId);
  if(display)await store.upsertNode({...display,status:'healthy',lastHeartbeat:new Date().toISOString()});
  const [incidents, devices] = await Promise.all([store.incidents(auth.orgId), store.nodes(auth.orgId)]);
  return NextResponse.json({updatedAt: new Date().toISOString(), devices: devices.filter(d=>d.providerKey!=='firetv'&&d.platform!=='firetv'&&!d.serverId.startsWith('firetv-')).map(d => ({id: d.serverId, name: d.displayName, status: d.status, liveView:d.providerKey==='ring'&&!!d.connectionId&&!!d.externalId})), incidents: incidents.sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,50).map(i => {
    const p=eventView(i.payload);
    return {id: i.incidentId, deviceId: i.serverId, state: i.state, at: i.startedAt, source: p.source || i.agentId, thumbnail: p.preview, frames:p.evidenceFrames, summary: p.aiSummary || p.assessment || "Open SmartDetector for observation details", observations: p.observations};
  })}, {headers: {"Cache-Control": "no-store"}});
}
