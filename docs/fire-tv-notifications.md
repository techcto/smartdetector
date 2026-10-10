# SmartDetector Console notifications

The TV web interface lives at `/tv` and uses a location-scoped, revocable, view-only display token. Its blue-and-white interface shares the console shield branding. Fire TV displays are excluded from the monitored-device list.

## Implemented web behavior

- Polls the authorized event feed every five seconds while visible.
- Treats the first feed as history, rather than notifying for every old event.
- Shows a dismissible, 15-second foreground alert for the newest newly observed event. Select **Review event** to open its details. This does not automatically take remote focus away from the viewer.
- **Alerts on/off** controls foreground alerts for the current session.
- Select a Ring camera, then **Live view → Start live view** for a video-only session limited to 30 seconds. **Stop**, **Close live view**, or remote Back closes the stream. Ring credentials stay on the server; display authorization and camera location are checked on every request. Ring permissions, connectivity, and the TV browser's WebRTC support determine availability. Actual Fire TV hardware playback still needs validation.
- Device history and event details show retained sampled frames and any returned detection boxes. Green boxes are detector output; dashed amber boxes are advisory AI grounding. These are not calibrated threat assessments.
- `/tv?event=<incident-id>` opens a matching event only after pairing and loading the authorized location feed. The ID never grants access by itself.
- The web display does not send notifications over other apps or while backgrounded.

## Native Fire OS integration still required

For an alert while another app is playing, package a native Fire OS client/bridge and integrate Amazon Device Messaging with the backend. Register each push destination against its authorized display connection, remove/revoke it on disconnect, and use Android notification channels and a high-priority heads-up notification with an explicit event-opening intent. Revalidate display authorization when opening the event; never put credentials in the deep link or push payload. Offer opt-in notification settings and avoid sensitive event content on shared screens by default.

Amazon distinguishes clickable heads-up notifications from noninteractive toasts. Device notification settings and Do Not Interrupt can suppress heads-up presentation. This integration is not implemented or validated on hardware yet; Vega OS requires a separate compatibility assessment.

References: [Fire TV notifications](https://developer.amazon.com/docs/fire-tv/notifications.html), [ADM message types](https://developer.amazon.com/docs/adm/message-types.html).
