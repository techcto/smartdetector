import {NextRequest, NextResponse} from "next/server";
import {authorizeTv} from "@/lib/tv";
import {store} from "@/lib/store";
export async function GET(req: NextRequest) {
  const auth = await authorizeTv(req.headers.get("authorization")?.replace(/^Bearer /, "") || "");
  if (!auth) return NextResponse.json({error: "Display access expired or revoked"}, {status: 401});
  const [incidents, devices] = await Promise.all([store.incidents(auth.orgId), store.nodes(auth.orgId)]);
  return NextResponse.json({updatedAt: new Date().toISOString(), devices: devices.map(d => ({id: d.serverId, name: d.displayName, status: d.status})), incidents: incidents.slice(0,50).map(i => {
    const p = i.payload as {kind?: string; source?: string; thumbnail?: string; classification?: {summary?: string}; observations?: unknown; assessment?: string; aiAssessment?: string};
    return {id: i.incidentId, deviceId: i.serverId, state: i.state, at: i.startedAt, source: p.source || i.agentId, thumbnail: p.thumbnail, summary: p.classification?.summary || p.aiAssessment || p.assessment || "Open SmartDetector for observation details", observations: p.observations};
  })}, {headers: {"Cache-Control": "no-store"}});
}
