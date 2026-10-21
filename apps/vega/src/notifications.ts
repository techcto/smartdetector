import { AmazonDeviceMessagingServer } from "@amazon-devices/kepler-amazon-device-messaging";
import { SERVICE_ORIGIN } from "./config";
export const backgroundAlertsAvailable = true;
export async function configureBackgroundAlerts(
  token: string,
  enabled: boolean
): Promise<void> {
  const registrationId = enabled
    ? await AmazonDeviceMessagingServer.registerAsync()
    : null;
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
    if (!enabled) await AmazonDeviceMessagingServer.unregisterAsync();
  } finally {
    clearTimeout(timer);
  }
}
