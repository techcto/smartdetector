import {
  TurboModuleRegistry,
  type KeplerTurboModule,
} from "@amazon-devices/keplerscript-turbomodule-api";
import {
  AppLaunchTarget,
  ToastKind,
} from "@amazon-devices/react-native-kepler/Libraries/Components/ToastKepler/NotificationManagerUtils";
import type { NotificationContent } from "@amazon-devices/react-native-kepler/Libraries/Components/ToastKepler/NativeNotificationManager";

// Same NotificationManager contract as SDK useToastKepler, without a React hook
// or UI runtime import. The OS renderer ultimately decides image presentation.
const manager = TurboModuleRegistry.getEnforcing<
  KeplerTurboModule & { post(content: NotificationContent): void }
>("NotificationManager");
export async function postSystemAlert(event: {
  id: string;
  summary: string;
  thumbnail?: string;
}): Promise<void> {
  const image =
    typeof event.thumbnail === "string" &&
    event.thumbnail.length <= 200000 &&
    /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(event.thumbnail)
      ? event.thumbnail
      : undefined;
  manager.post({
    mTitle: "SmartDetector camera activity",
    mDescription: event.summary.slice(0, 240),
    mIconUri: image ?? "@image/smartdetector-icon.png",
    ...(image ? { mLargeIconUri: image } : {}),
    mTimeout: 8,
    mLaunchTargets: [
      new AppLaunchTarget(
        "pkg://com.smartdetector.console.main",
        "Check cameras",
        "@image/smartdetector-icon.png"
      ),
    ],
    mChannel: {
      name: "MenuToastRenderTemplate",
      importance: {
        importance:
          "NORMAL" as NotificationContent["mChannel"]["importance"]["importance"],
      },
      kind: new ToastKind(),
    },
  });
}
