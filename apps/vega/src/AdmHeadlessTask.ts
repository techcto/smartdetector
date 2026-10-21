import { AmazonDeviceMessagingServer } from "@amazon-devices/kepler-amazon-device-messaging";
import { SERVICE_ORIGIN } from "./config";
import { postSystemAlert } from "./system-popup";

// No UI imports, AppState or persisted display login in this runtime.
export async function doTask(): Promise<void> {
  AmazonDeviceMessagingServer.registerHandler({
    async handleOnMessage(message) {
      const wake = message.data?.wake;
      if (typeof wake !== "string" || wake.length > 2000) return;
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(SERVICE_ORIGIN + "/api/v1/tv/push/event", {
          headers: { Authorization: "Bearer " + wake },
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 404) return;
        if (!response.ok) throw Error("Notification event unavailable");
        const event = await response.json();
        if (typeof event.id !== "string" || typeof event.summary !== "string")
          throw Error("Invalid notification event");
        await postSystemAlert(event);
        console.info("SmartDetector background notification posted");
      } finally {
        clearTimeout(timer);
      }
    },
  });
  await AmazonDeviceMessagingServer.waitForMessageHandlerCompletionAsync(
    new Date(Date.now() + 10000)
  );
}
