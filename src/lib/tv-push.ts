import { randomUUID } from "node:crypto";
import { authorizeTv, signTvValue, verifyTvValue } from "./tv";
import {
  setting,
  listSettings,
  encryptSecret,
  decryptSecret,
  saveTvPush,
} from "./providers";
import { store } from "./store";
import { eventView } from "./event-view";
import type { IncidentRecord } from "./model";
import { deliverTvAlert } from "./event-delivery";

const scope = (org: string, id: string) =>
  org + ":" + id + ":admRegistrationId";
export async function registerTvPush(
  token: string,
  registrationId: string | null
) {
  const access = await authorizeTv(token);
  if (!access) return null;
  if (
    registrationId !== null &&
    (!registrationId ||
      registrationId.length > 4096 ||
      /\s/.test(registrationId))
  )
    throw Error("Invalid registration");
  const row = await setting(access.orgId, access.connectionId);
  if (!row?.enabled || row.providerKey !== "firetv") return null;
  const generation = randomUUID(),
    expiresAt = registrationId ? access.expiresAt : 0;
  const saved = await saveTvPush(access.orgId, access.connectionId, {
    registrationId: registrationId
      ? encryptSecret(registrationId, scope(access.orgId, access.connectionId))
      : "",
    expiresAt,
    generation,
  });
  if (!saved) return null;
  return { enabled: !!registrationId, expiresAt };
}

let oauth: { token: string; expiresAt: number } | undefined;
async function admAccess(fetcher: typeof fetch) {
  if (oauth && oauth.expiresAt > Date.now() + 60000) return oauth.token;
  const clientId = process.env.SMARTDETECTOR_ADM_CLIENT_ID,
    secret = process.env.SMARTDETECTOR_ADM_CLIENT_SECRET;
  if (!clientId || !secret) throw Error("ADM credentials unavailable");
  const r = await fetcher("https://api.amazon.com/auth/O2/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "messaging:push",
      client_id: clientId,
      client_secret: secret,
    }),
  });
  if (!r.ok) throw Error("ADM authentication failed");
  const result = await r.json();
  if (
    typeof result.access_token !== "string" ||
    typeof result.expires_in !== "number" ||
    !Number.isFinite(result.expires_in)
  )
    throw Error("Invalid ADM authentication response");
  oauth = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max(0, result.expires_in) * 1000,
  };
  return oauth.token;
}

export async function queueTvAlerts(incident: IncidentRecord) {
  if (
    process.env.SMARTDETECTOR_ADM_ENABLED !== "true" ||
    !eventView(incident.payload).personNotify
  )
    return;
  for (const display of await listSettings(incident.tenantId))
    if (
      display.enabled &&
      display.providerKey === "firetv" &&
      display.adm?.registrationId &&
      Number(display.adm?.expiresAt) > Date.now()
    )
      await deliverTvAlert(incident.tenantId, incident.incidentId, display.id);
}

export async function sendTvPush(
  incident: IncidentRecord,
  connectionId: string,
  fetcher: typeof fetch = fetch
) {
  if (process.env.SMARTDETECTOR_ADM_ENABLED !== "true") return;
  const view = eventView(incident.payload);
  if (!view.personNotify) return;
  // ADM receives no footage, descriptive text, long-lived display capability or URLs.
  const display = await setting(incident.tenantId, connectionId);
  if (
    display?.enabled &&
    display.providerKey === "firetv" &&
    display.adm?.registrationId &&
    Number(display.adm?.expiresAt) > Date.now()
  ) {
    const registrationId = decryptSecret(
      display.adm?.registrationId,
      scope(incident.tenantId, display.id)
    );
    const wake = signTvValue({
      purpose: "tv-notification",
      orgId: incident.tenantId,
      connectionId: display.id,
      incidentId: incident.incidentId,
      generation: display.adm?.generation,
      expiresAt: Math.min(Date.now() + 120000, Number(display.adm?.expiresAt)),
    });
    const response = await fetcher(
      "https://api.amazon.com/messaging/registrations/" +
        encodeURIComponent(registrationId) +
        "/messages",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: "Bearer " + (await admAccess(fetcher)),
          "Content-Type": "application/json",
          "X-Amzn-Type-Version": "com.amazon.device.messaging.ADMMessage@1.0",
          Accept: "application/json",
          "X-Amzn-Accept-Type": "com.amazon.device.messaging.ADMSendResult@1.0",
        },
        body: JSON.stringify({
          data: { wake },
          consolidationKey: incident.incidentId.slice(0, 64),
          expiresAfter: 120,
        }),
      }
    );
    if (response.status === 401) oauth = undefined;
    let unregistered = response.status === 404 || response.status === 410;
    if (response.status === 400) {
      const error = await response.json().catch(() => null);
      unregistered =
        error?.reason === "UnregisteredDevice" ||
        error?.reason === "InvalidRegistrationId";
    }
    if (unregistered) {
      await disableInvalidRegistration(
        incident.tenantId,
        display.id,
        display.adm?.generation
      );
      return;
    }
    if (!response.ok)
      throw Error("ADM delivery failed (" + response.status + ")");
  }
}

async function disableInvalidRegistration(
  org: string,
  id: string,
  generation: string
) {
  const row = await setting(org, id);
  if (row?.adm?.generation === generation)
    await saveTvPush(org, id, { ...row.adm, expiresAt: 0 }, generation);
}

export async function tvPushEvent(wake: string) {
  if (process.env.SMARTDETECTOR_ADM_ENABLED !== "true") return null;
  const value = verifyTvValue(wake);
  if (
    !value ||
    value.purpose !== "tv-notification" ||
    typeof value.orgId !== "string" ||
    typeof value.connectionId !== "string" ||
    typeof value.incidentId !== "string" ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt <= Date.now()
  )
    return null;
  const connection = await setting(value.orgId, value.connectionId);
  if (
    !connection?.enabled ||
    connection.providerKey !== "firetv" ||
    !connection.adm?.registrationId ||
    connection.adm?.generation !== value.generation ||
    !(Number(connection.adm?.expiresAt) > Date.now())
  )
    return null;
  const incident = await store.incident(value.orgId, value.incidentId);
  if (!incident) return null;
  const view = eventView(incident.payload);
  if (!view.personNotify) return null;
  return {
    id: incident.incidentId,
    at: incident.startedAt,
    summary: (
      view.aiSummary ||
      view.assessment ||
      "Camera activity detected"
    ).slice(0, 240),
    thumbnail: view.preview || view.evidenceFrames[0]?.preview,
  };
}
