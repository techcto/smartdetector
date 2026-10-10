import {createHmac, timingSafeEqual, createHash} from "node:crypto";
import {ringAccess} from "./ring-link";
import {analyzeFrames} from "./vision-analysis";

export function verifyRingSignature(raw: string, signature: string, secret: string) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature.slice(7), "hex"), createHmac("sha256", secret).update(raw).digest());
}
export type RingEvent = {requestId: string; accountId: string; deviceId: string; timestamp: number; type: string; componentId?: string};
export function parseRingEvent(raw: string, now = Date.now()): RingEvent {
  const v = JSON.parse(raw), m = v.meta, a = v.data?.attributes;
  if (m?.version !== "1.1" || typeof m.request_id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(m.request_id) || typeof m.account_id !== "string" || typeof a?.source !== "string" || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(a.source) || !Number.isSafeInteger(a.timestamp) || Math.abs(now - Date.parse(m.time)) > 600000 || !Number.isFinite(Date.parse(m.time))) throw new Error("Invalid or expired Ring event");
  if (!["motion_detected", "button_press"].includes(v.data.type)) throw new Error("Unsupported Ring event");
  const components = a.component_ids;
  if (components !== undefined && (!Array.isArray(components) || components.length !== 1 || typeof components[0] !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(components[0]))) throw new Error("Select one camera component");
  return {requestId: m.request_id, accountId: m.account_id, deviceId: a.source, timestamp: a.timestamp, type: v.data.type, ...(components ? {componentId: components[0]} : {})};
}
export class RingClient {
  constructor(private token: string, private fetcher: typeof fetch = fetch) {}
  async devices() {
    const r = await this.fetcher("https://api.amazonvision.com/v1/devices?include=capabilities", {headers: {Authorization: "Bearer " + this.token}, signal: AbortSignal.timeout(15000), redirect: "error"});
    if (!r.ok) throw new Error("Ring device discovery failed (HTTP " + r.status + ")");
    const document=await r.json();
    if(!Array.isArray(document.data))throw new Error('Invalid Ring discovery response');
    // Do not offer sensors or chimes as cameras just because they share an account.
    const included=Array.isArray(document.included)?document.included:[];
    return {...document,data:document.data.filter((d:{relationships?:{capabilities?:{data?:{id?:string}}}})=>{const id=d.relationships?.capabilities?.data?.id;const caps=included.find((c:{id?:string;type?:string})=>id&&c.id===id&&c.type==='device-capabilities')?.attributes;return (Array.isArray(caps?.video?.codecs)&&caps.video.codecs.length>0)||caps?.components?.items?.some((c:{component_type?:string})=>c.component_type==='lens')})};
  }
  async snapshot(deviceId: string, timestamp: number, componentId?: string, latest=false): Promise<string> {
    if (!/^[a-zA-Z0-9_.:-]{1,200}$/.test(deviceId) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid Ring media request");
    const r = await this.fetcher("https://api.amazonvision.com/v1/devices/" + encodeURIComponent(deviceId) + "/media/image/download", {method: "POST", headers: {Authorization: "Bearer " + this.token, "Content-Type": "application/json"}, body: JSON.stringify({...latest?{type:'latest_in_range',start_timestamp:timestamp-86400000,end_timestamp:timestamp}:{type:'at_timestamp',timestamp}, image_options: {format: "jpeg", resolution: {width: 640, height: 360}}, ...(componentId ? {components: [{component_id: componentId}]} : {})}), redirect: "manual", signal: AbortSignal.timeout(15000)});
    if (r.status === 403 && latest) {
      const error = await r.json().catch(() => null);
      if (error?.errors?.some((e: {code?: string}) => e.code === 'TIME_RANGE_NOT_AUTHORIZED')) {
        // Ring history is consent-filtered. Do not guess a range before consent.
        const history = await this.fetcher('https://api.amazonvision.com/v1/history/devices/' + encodeURIComponent(deviceId) + '/events', {headers: {Authorization: 'Bearer ' + this.token}, redirect: 'error', signal: AbortSignal.timeout(15000)});
        if (!history.ok) throw new Error('Ring authorized history unavailable (HTTP ' + history.status + ')');
        const document = await history.json();
        const times = (Array.isArray(document.data) ? document.data : []).map((e: {attributes?: {start?: unknown}}) => Number(e.attributes?.start)).filter((t: number) => Number.isSafeInteger(t) && t > 0 && t <= timestamp && t >= timestamp - 86400000);
        if (!times.length) throw new Error('No authorized recent Ring recording available');
        return this.snapshot(deviceId, Math.max(...times), componentId);
      }
    }
    if (r.status !== 303) throw new Error("Ring snapshot unavailable (HTTP " + r.status + ")");
    const url = new URL(r.headers.get("location") || "");
    const ringDownload = /^download-[a-z]{2}(?:-[a-z]+)+-\d\.prod\.phoenix\.devices\.amazon\.dev$/.test(url.hostname);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !(ringDownload || ["amazonvision.com", "ring.com", "amazonaws.com"].some(d => url.hostname === d || url.hostname.endsWith("." + d)))) throw new Error("Untrusted Ring media redirect");
    // Never forward OAuth credentials to a pre-signed media URL.
    const media = await this.fetcher(url, {redirect: "error", signal: AbortSignal.timeout(15000)});
    if (!media.ok || !/^image\/(jpeg|png)(;|$)/i.test(media.headers.get("content-type") || "")) throw new Error("Invalid Ring image response");
    const reader = media.body?.getReader(); if (!reader) throw new Error("Empty Ring media");
    const chunks: Uint8Array[] = []; let size = 0;
    try {for (;;) {const v = await reader.read(); if (v.done) break; size += v.value.length; if (size > 1000000) throw new Error("Ring image too large"); chunks.push(v.value);}} finally {await reader.cancel();}
    const image = Buffer.concat(chunks);
    if (!(image.subarray(0,3).equals(Buffer.from([255,216,255])) || image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))) throw new Error("Unsupported Ring image bytes");
    return image.toString("base64");
  }
}
export async function processRingEvent(orgId: string, connectionId: string, event: RingEvent, fetcher: typeof fetch = fetch) {
  const config = await ringAccess(orgId, connectionId, fetcher);
  if (!config?.accessToken || config.accountId !== event.accountId) throw new Error("Ring account not authorized for organization");
  const client = new RingClient(config.accessToken, fetcher), frames = [];
  // Three snapshots from recorded media, not an invented full-video upload API.
  for (const offset of [0, 1000, 2000]) frames.push({image: await client.snapshot(event.deviceId, event.timestamp + offset, event.componentId), at_ms: offset});
  const deviceId = "ring-" + createHash("sha256").update(event.deviceId).digest("hex").slice(0,24);
  return analyzeFrames(orgId, deviceId, frames, true, "ring", connectionId + ":" + event.requestId, fetcher,event.timestamp);
}
