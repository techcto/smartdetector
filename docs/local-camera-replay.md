# Ring-free local camera events

This is an explicit local testing tool, not a Ring connection or an automatic
production data seeder. No private camera access or Ring credentials are needed.

## Start and send a sample

### Two-camera event container (optional offline fallback)

```bash
bash app.sh up
docker compose --profile test-cameras up -d smartdetector-test-cameras
docker compose logs -f smartdetector-test-cameras
```

This opts into a local-only container that creates **TEST · Ring Front Door** and
**TEST · Ring Back Yard** in root’s workspace. It sends the first event from each
camera within four seconds, then alternates every 15 seconds (240 events by
default, approximately one hour). Each event retains up to three sample JPEGs,
recorded detections, and the recorded-replay label. Device IDs remain stable
across restarts. They appear under Cameras and in the normal scoped TV feed.
They are explicitly `ring-test` fixtures, **not authorized Ring connections**;
live view, account linking, webhook signatures and Ring delivery are not tested.
No AutoVision/Bedrock calls or external notifications run.

```bash
docker compose stop smartdetector-test-cameras
docker compose --profile test-cameras restart smartdetector-test-cameras
```

Optional `.env` variables: `SMARTDETECTOR_TEST_EVENT_COUNT` (2–10000) and
`SMARTDETECTOR_TEST_EVENT_INTERVAL` (4–300 seconds). The container reads the same
root credentials as the local web service at runtime, never from an image. It
shares the web container’s network namespace to call loopback, publishes no ports,
runs read-only as a non-root user, and is absent from CloudFormation/production.
After recreating the web container, recreate this fixture container too. Removing
a fixture device blocks that ID from rejoining; stop the emitter before deletion.

### Official Ring Playground versus local replay

Ring’s [Developer Playground release notes](https://developer.amazon.com/docs/ring/release-notes.html)
describe a 30-minute token, API explorer, and simulated Package/Vehicle/Motion live
view sessions without account linking or an active subscription. A local backend
can call those APIs outbound. On localhost, sign in as root and open **Devices → Ring**
(`http://localhost:8082/devices/integrations/ring`). Select **Connect provider**,
then expand **Developer testing · Ring Playground** in the Connect Ring drawer.
The compact token form automatically discovers authorized cameras using
the existing Ring API client. Open a discovered camera for Refresh image or Live
view. Tokens are encrypted server-side, capped at the earlier of JWT expiry or
30 minutes after entry, and never automatically refreshed. After expiry, paste a
fresh token in the same panel. Camera records and saved history are preserved;
identical upstream Ring device IDs map to identical local IDs across reconnects.
Normal 24-hour/default event retention remains separate. Forget token removes
credentials only, not devices or history. The adapter is gated to local storage,
log-only notifications and a loopback/root-only connect endpoint, and is not
enabled by CloudFormation. Do not commit tokens or include them in screenshots. API exploration alone does not prove webhook
delivery into SmartDetector or end-to-end TV event processing.

Real staging account-link/webhook tests are separate and require the portal’s
staging setup and reachable HTTPS callbacks; see the
[Ring development guide](https://developer.amazon.com/docs/ring/develop.html).

### One-shot replay

```bash
bash app.sh up
npm run local:replay -- --sample intruder
```

Open http://localhost:8082 and sign in to the same root workspace. The local
default is `root` / `smartdetector-local-change-me`; if changed, supply
`SMARTDETECTOR_REPLAY_USER` and `SMARTDETECTOR_REPLAY_PASSWORD` through your shell.
Never put real credentials into committed files or command flags.

The script prints the saved event URL. Look for a device named `TEST · intruder`.
Other samples: `backyardintruder`, `package`, `dognight`.

For new-event/foreground-alert testing while the TV app stays open:

```bash
npm run local:replay -- --sample package --count 5 --interval 10
```

The loop is capped at 20 events with a minimum three-second interval. Ctrl+C stops
it. The root-only endpoint is rate-limited per local process and only works with
the Compose opt-in flag, local DynamoDB endpoint and log-only notifications.
The script rejects non-loopback origins and refuses redirects. No CloudFormation
template enables this flag. Keep this opt-in absent from real deployments.

## Recorded versus live

Default **recorded** mode replays the existing sample clip's measured report and
JPEG frames. The clip SHA-256 must match its report. Events are stamped with the
replay time but retain the original report date and a visible recorded-replay
label. They use normal event persistence, thumbnail/box handling and scoped TV
feeds. No Ring, AutoVision, Bedrock, face matching or external notification calls
are made. Foreground TV notifications depend on the display already being open.
This proves UI/data delivery, not a new analysis or a real Ring webhook.

With a configured AutoVision service, run:

```bash
npm run local:replay -- --sample intruder --live
```

This sends the saved JPEG pixels through the existing analysis path and saves
fresh results; it does not import recorded detections. Classification is disabled
(`classify=false`). AutoVision quotas still apply. It fails if that service is
missing and never silently falls back to recorded results. Optional downstream
enrichment follows your local settings; use recorded mode for no-provider tests.

## Connect the TV

The full Compose stack includes the **web TV** at http://localhost:8082/tv.
Get a code, then approve it at http://localhost:8082/tv/connect in the same root
workspace. The React Native Web preview on 8090 is a separate tool and currently
proxies to the hosted service by default; do not confuse its pairing with this
local stack.

For Goyal's native Ubuntu Vega simulator, rebuild with
`SMARTDETECTOR_VEGA_ORIGIN` set to the HTTPS origin of **his own** local backend
(for example, a temporary authenticated development tunnel). Pair against that
same origin. `localhost` inside a virtual device is not the host backend, and the
native client intentionally requires HTTPS. Protect any tunnel with a strong
local root password; stop it after testing. No access to your Ring account is
needed. Run replay against host localhost, not the public tunnel address.

Recorded testing does not certify Ring linking, live camera playback, remote
microphone capture or background/system TV notifications.
