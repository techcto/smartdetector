import { AmazonDeviceMessagingServer } from "@amazon-devices/kepler-amazon-device-messaging";
import { SERVICE_ORIGIN } from "./config";
import { nativeMessaging } from "./settings-feedback.mjs";
export const backgroundAlertsAvailable = true;
export async function configureBackgroundAlerts(
  token: string,
  enabled: boolean
): Promise<void> {
  if (enabled) {
    const capabilityController = new AbortController();
    const capabilityTimer = setTimeout(() => capabilityController.abort(), 10000);
    try {
      const response = await fetch(SERVICE_ORIGIN + "/api/v1/tv/push", {headers:{Authorization:"Bearer "+token},signal:capabilityController.signal});
      if (response.status === 401) throw Error("Display access expired. Pair this console again.");
      if (!response.ok || !(await response.json()).configured) throw Error("Background TV alerts are not enabled on the server. In-app alerts still work.");
    } finally { clearTimeout(capabilityTimer); }
  }
  const registrationId = enabled ? await nativeMessaging(() => AmazonDeviceMessagingServer.registerAsync()) : null;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(SERVICE_ORIGIN + "/api/v1/tv/push", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registrationId }),
    });
    if (!response.ok)
      throw Error(
        response.status === 503
          ? "Server messaging is not configured yet"
          : "Unable to update background alerts"
      );
    // The server has already revoked delivery. Device cleanup cannot undo that
    // revocation or leave the UI stuck on after a native service timeout.
    if (!enabled) await nativeMessaging(() => AmazonDeviceMessagingServer.unregisterAsync()).catch(() => undefined);
  } finally {
    clearTimeout(timer);
  }
}
