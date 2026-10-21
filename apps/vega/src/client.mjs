export class AccessRevoked extends Error {}
export function serviceOrigin(value) {
  const u = new URL(value);
  if (
    !(u.protocol === "https:" || u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    throw Error("Use an HTTPS SmartDetector origin (HTTP is allowed only on loopback for local testing)");
  return u.origin;
}
// Vega TV has no web browser: external pages are shown as URLs to open on another device.
const externalPages = {
  pairing: ["Pairing approval", "/tv/connect", "Sign in, select the location for this TV, and enter the code shown on the TV."],
  privacy: ["Privacy policy", "/privacy", "Read how SmartDetector processes camera images and how long they are kept."],
  dataDeletion: ["Delete saved data", "/privacy#data-deletion", "Follow the steps there to delete saved events and images without deleting your account."],
  accountDeletion: ["Request account deletion", "/privacy#account-deletion", "Follow the steps there to request deletion of your SmartDetector account."],
  devices: ["Add device", "/devices", "Sign in, select this same location, and connect your Ring account to discover shared cameras."],
  ring: ["Ring connection", "/devices/integrations/ring", "Sign in and manage the Ring connection for this location."],
  liveView: ["Camera live view", "/devices/", "Sign in and open this camera to start live view in the web console."],
};
export function externalLink(origin, page, deviceId) {
  const entry = Object.hasOwn(externalPages, page) ? externalPages[page] : null;
  if (!entry || (page === "liveView") !== (typeof deviceId === "string" && deviceId.length > 0))
    throw Error("Unknown external page");
  const [title, path, detail] = entry;
  return { title, url: serviceOrigin(origin) + path + (page === "liveView" ? encodeURIComponent(deviceId) : ""), detail };
}
export function displayDevices(devices) {
  return devices.filter(
    (d) =>
      !d.id.startsWith("firetv-") &&
      d.platform !== "firetv" &&
      d.providerKey !== "firetv",
  );
}
export function eventsForDevice(events, id) {
  return id ? events.filter((e) => e.deviceId === id) : events;
}
export function newAlert(previous, events) {
  return previous
    ? events.find((e) => e.notify !== false && !previous.has(e.id))
    : undefined;
}
export function safePreview(value) {
  return typeof value === "string" &&
    value.length <= 6000000 &&
    /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=\r\n]+$/.test(value)
    ? value
    : undefined;
}
export function createClient(origin, fetcher = fetch) {
  const base = serviceOrigin(origin);
  async function request(path, { token, body, signal } = {}) {
    const c = new AbortController(),
      abort = () => c.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) c.abort();
    const timer = setTimeout(abort, 15000);
    try {
      const r = await fetcher(base + path, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: c.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (r.status === 401)
        throw new AccessRevoked(
          "Display access expired or revoked. Pair again.",
        );
      if (!r.ok) throw Error("Request failed (" + r.status + "). Try again.");
      return await r.json();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  return {
    begin: (signal) =>
      request("/api/v1/tv/pair", {
        body: { name: "SmartDetector Vega Console" },
        signal,
      }),
    poll: (deviceCode, signal) =>
      request("/api/v1/tv/pair", { body: { deviceCode }, signal }),
    feed: (token, signal) => request("/api/v1/tv/feed", { token, signal }),
    search: (token, query, deviceId, signal) =>
      request("/api/v1/events/search", {
        token,
        body: {
          query,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...(deviceId ? { deviceId } : {}),
        },
        signal,
      }),
  };
}
