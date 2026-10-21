import {scheduleNotificationAsync} from "@amazon-devices/expo-notifications";
import {Importance, InformationKind} from "@amazon-devices/expo-notifications/build/kepler";

// Normal importance does not request restricted alarm/system privileges.
// OS rendering and whether this appears over playback require hardware validation.
export async function postSystemAlert(event: {id: string; summary: string}): Promise<void> {
  await scheduleNotificationAsync({
    content: {
      title: "SmartDetector camera activity",
      body: event.summary.slice(0, 240),
      data: {incidentId: event.id},
      iconUri: "@image/smartdetector-icon.png",
      channel: {
        name: "Camera activity",
        description: "Camera activity from your paired SmartDetector location",
        importance: {importance: Importance.IMPORTANCE_NORMAL},
        kind: new InformationKind(),
      },
      sound: false,
    },
    trigger: null,
  });
}
