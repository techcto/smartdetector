import {createHash} from "node:crypto";
import {connection} from "./vision-connection";
import {store} from "./store";
import {ingest} from "./signals";

export type VisionFrame = {image: string; at_ms: number};
export type VisionResult = {job_id?: string; thumbnail?: string; classification?: {status: string; summary?: string}; observations: {type: string; value: number; detected: boolean; advisory?: boolean}[]; frames?: unknown[]; engine_version?: string};
export async function analyzeFrames(orgId: string, deviceId: string, frames: VisionFrame[], classify: boolean, source = "manual", requestId?: string, fetcher: typeof fetch = fetch) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(deviceId) || !Array.isArray(frames) || frames.length < 1 || frames.length > 12 || typeof classify !== "boolean") throw new Error("Invalid analysis input");
  let previous = -1;
  for (const f of frames) {
    if (!f || typeof f.image !== "string" || f.image.length > 1500000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.image) || !Number.isFinite(f.at_ms) || f.at_ms <= previous || f.at_ms > 30000) throw new Error("Invalid sampled frame");
    previous = f.at_ms;
  }
  const key = await connection();
  if (!key) throw new Error("AutoVision system service is not configured");
  const r = await fetcher((process.env.SMARTDETECTOR_AUTOVISION_URL || "https://autovision.dev") + "/api/v1/analyze", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + key}, body: JSON.stringify({frames, classify}), signal: AbortSignal.timeout(85000), redirect: "error"});
  if (!r.ok) throw new Error("AutoVision analysis failed (HTTP " + r.status + ")");
  const result = await r.json() as VisionResult;
  if (!Array.isArray(result.observations)) throw new Error("Invalid AutoVision result");
  const at = new Date().toISOString();
  for (const o of result.observations) if (["motion", "person"].includes(o.type) && Number.isFinite(o.value)) await ingest(orgId, source, {device_id: deviceId, type: o.type as "motion" | "person", value: o.value});
  const incidentId = createHash("sha256").update(orgId + "|" + source + "|" + (requestId || result.job_id || at)).digest("hex");
  await store.putIncident({tenantId: orgId, agentId: source, serverId: deviceId, incidentId, state: "review", startedAt: at, updatedAt: at, payload: {kind: "vision-review", source, autoVisionJobId: result.job_id, thumbnail: result.thumbnail, observations: result.observations, classification: result.classification, engineVersion: result.engine_version, advisory: true, assessment: "Visual observation for human review; not an intruder or emergency determination."}});
  return {incidentId, analysis: result};
}
