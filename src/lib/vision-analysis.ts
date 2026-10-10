import {visionConfig} from './system-vision';
import {createHash} from "node:crypto";
import {connection} from "./vision-connection";
import {store} from "./store";
import {ingest} from "./signals";
import {historyCutoff} from './history-privacy';
import {detectionFrames} from './object-detections';

export type VisionFrame = {image: string; at_ms: number};
export function evidenceFrames(frames: VisionFrame[],analysis?:unknown) {
  const measured=detectionFrames(analysis);
  let remaining=180000;
  return frames.slice(0,12).flatMap(f=>{
    if(f.image.length>60000||f.image.length>remaining)return [];
    const bytes=Buffer.from(f.image,'base64'),mime=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))?'jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':null;
    if(!mime)return [];remaining-=f.image.length;
    return [{at_ms:f.at_ms,preview:'data:image/'+mime+';base64,'+f.image,detections:measured.find(m=>m.at_ms===f.at_ms)?.detections??[]}];
  });
}
export type VisionResult = {job_id?: string; thumbnail?: string; classification?: {status: string; summary?: string}; observations: {type: string; value: number; detected: boolean; advisory?: boolean}[]; frames?: unknown[]; engine_version?: string};
export async function analyzeFrames(orgId: string, deviceId: string, frames: VisionFrame[], classify: boolean, source = "manual", requestId?: string, fetcher: typeof fetch = fetch,observedAt=Date.now()) {
  if(observedAt<=await historyCutoff(orgId))throw Error('History was purged');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(deviceId) || !Array.isArray(frames) || frames.length < 1 || frames.length > 12 || typeof classify !== "boolean") throw new Error("Invalid analysis input");
  let previous = -1;
  for (const f of frames) {
    if (!f || typeof f.image !== "string" || f.image.length > 1500000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.image) || !Number.isFinite(f.at_ms) || f.at_ms <= previous || f.at_ms > 30000) throw new Error("Invalid sampled frame");
    previous = f.at_ms;
  }
  const key = await connection();
  if (!key) throw new Error("AutoVision system service is not configured");
  const r = await fetcher((await visionConfig()).url + "/api/v1/analyze", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + key}, body: JSON.stringify({frames, classify}), signal: AbortSignal.timeout(85000), redirect: "error"});
  if (!r.ok) throw new Error("AutoVision analysis failed (HTTP " + r.status + ")");
  const result = await r.json() as VisionResult;
  if (!Array.isArray(result.observations)) throw new Error("Invalid AutoVision result");
  const at = new Date(observedAt).toISOString();
  if(observedAt<=await historyCutoff(orgId))throw Error('History was purged');
  for (const o of result.observations) if (["motion", "person"].includes(o.type) && Number.isFinite(o.value)) await ingest(orgId, source, {device_id: deviceId, type: o.type as "motion" | "person", value: o.value},at);
  const incidentId = createHash("sha256").update(orgId + "|" + source + "|" + (requestId || result.job_id || at)).digest("hex");
  const evidence=evidenceFrames(frames,result.frames),detections=detectionFrames(result.frames);
  await store.putIncident({tenantId: orgId, agentId: source, serverId: deviceId, incidentId, state: "review", startedAt: at, updatedAt: at, payload: {kind: "vision-review", source, autoVisionJobId: result.job_id, thumbnail: evidence[0]?.preview, evidenceFrames:evidence, detectionFrames:detections, detectionSchemaVersion:1, observations: result.observations, classification: result.classification, engineVersion: result.engine_version, advisory: true, assessment: "Visual observation for human review; not an intruder or emergency determination."}});
  return {incidentId, analysis: result};
}
