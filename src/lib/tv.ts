import {createHmac, timingSafeEqual} from "node:crypto";
import {setting, saveSetting, removeSetting} from "./providers";
import {store} from './store';
type Capability = {purpose: "tv-feed"; orgId: string; connectionId: string; expiresAt: number};
function signingKey() {const secret = process.env.SMARTDETECTOR_SESSION_SECRET; if (!secret || secret.length < 32) throw new Error("TV signing secret required"); return createHmac("sha256", secret).update("smartdetector-tv-read-only-v1").digest();}
export async function issueTvAccess(orgId: string, userId: string, name: string) {
  const connection = await saveSetting(orgId, userId, {providerKey: "firetv", name, settings: {applicationId: "smartdetector-tv"}});
  await store.upsertNode({tenantId:orgId,serverId:'firetv-'+connection.id,agentId:'firetv',displayName:name,platform:'firetv',providerKey:'firetv',connectionId:connection.id,modelId:'firetv-display',tags:[],status:'pending',createdAt:new Date().toISOString(),lastHeartbeat:new Date(0).toISOString()});
  const value: Capability = {purpose: "tv-feed", orgId, connectionId: connection.id, expiresAt: Date.now() + 86400000};
  const body = Buffer.from(JSON.stringify(value)).toString("base64url"), signature = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return {token: body + "." + signature, connectionId: connection.id, expiresAt: value.expiresAt};
}
export async function authorizeTv(token: string): Promise<Capability | null> {
  if (token.length > 2000) return null;
  const parts = token.split("."); if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const expected = createHmac("sha256", signingKey()).update(parts[0]).digest(), actual = Buffer.from(parts[1], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let value: Capability; try {value = JSON.parse(Buffer.from(parts[0], "base64url").toString());} catch {return null;}
  if (value.purpose !== "tv-feed" || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() || typeof value.orgId !== "string" || typeof value.connectionId !== "string") return null;
  const c = await setting(value.orgId, value.connectionId);
  return c?.enabled && c.providerKey === "firetv" ? value : null;
}
export async function disconnectTv(orgId:string,connectionId:string){
 const connection=await setting(orgId,connectionId);if(!connection||connection.providerKey!=='firetv')return false;
 const removed=await removeSetting(orgId,connectionId);
 const display=await store.node(orgId,'firetv-'+connectionId);
 if(display)await store.upsertNode({...display,status:'offline'});
 return removed;
}
