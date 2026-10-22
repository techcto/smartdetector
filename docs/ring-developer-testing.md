# Ring developer testing

Integration scope: SmartDetector’s own Bedrock feature summarizes incident observations. AutoVision, where mentioned below, is an optional, separately developed external detection add-on outside this hackathon submission. Its connector is free to add; external service configuration, quotas and costs still apply. Steps that invoke that add-on require it and are not evidence of native SmartDetector image detection.

## Developer account and Playground

1. Sign in or create an account at [Amazon Developer](https://developer.amazon.com/).
   Complete the registration prompts. Open the [Ring Developer Console](https://developer.amazon.com/ring/console)
   and select **Playground**. See [Ring registration](https://developer.amazon.com/docs/ring/get-started.html)
   if access is not available for your account.
2. Select **Generate token**. The temporary token lasts 30 minutes. Ring’s
   [Playground release notes](https://developer.amazon.com/docs/ring/release-notes.html)
   explain that production app creation, account linking and an active Ring
   subscription are not required for this sandbox.
3. Select **Device List → Invoke** and check that devices are returned. Device
   Discovery shows capabilities. Package/Vehicle/Motion buttons demonstrate live
   video in Ring’s Playground, not signed webhook delivery into SmartDetector.

Do not put tokens in chat, screenshots, Git, command arguments, or public files.

## Connect local SmartDetector

```bash
bash app.sh up
```

1. Sign in at `http://localhost:8082/login` using local root credentials. Defaults
   are `root` / `smartdetector-local-change-me`; overrides belong in ignored `.env`.
2. Open **Devices → Ring → Connect provider**. In the **Connect Ring** drawer,
   expand **Developer testing · Ring Playground** at the bottom.
3. Paste the temporary token and select **Connect test cameras**. The existing
   Ring API client validates it and discovers authorized cameras automatically.
4. Open a **PLAYGROUND** camera. Try **Refresh image** or **Live view**. Availability
   depends on Ring’s media/capabilities. Live sessions are bounded to at most 30
   seconds and are capped by the token’s remaining lifetime.
5. When the token expires, generate another in Ring and use the same drawer to
   replace it. Matching upstream device IDs keep matching local camera IDs and
   their saved history. If Ring returns different IDs, those are new devices.

Only the credential expires: the earlier of its JWT expiry or 30 minutes after
entry. There is no refresh or fallback to production credentials. **Forget token**
also removes credentials only. Cameras/history remain; normal event-image retention
is separate (24 hours by default, longer only through explicit paid settings).

The developer option is compact and inside the normal connection flow, not a
separate page panel. It appears only to local root users: the browser must be on a
loopback hostname, and the API additionally requires the opt-in flag, local storage,
log-only notifications, root authorization and same-origin mutations. Both production
SaaS and private CloudFormation deployments omit this flag and use AWS storage;
neither exposes the option/API. `NODE_ENV=production` alone does not identify a
deployment: local Compose intentionally runs production builds against local storage.

## Production or real staging provider

The normal **Connect Ring** flow remains unchanged. Root configures the registered
Ring app credentials under **Account → Admin**. Follow the Ring setup screen’s
generated account-link, token-exchange and webhook URLs. Callback testing needs a
reachable HTTPS deployment or secured development tunnel—not a localhost callback.
Use Ring’s Test/account-linking workflow, authorize the real cameras, confirm the
SmartDetector workspace, then check the connection and **Sync shared cameras**.
See [Ring staging development/testing](https://developer.amazon.com/docs/ring/develop.html).
Do not paste a Playground token into client-secret or authorization-code fields.

No real provider is linked automatically by starting local Compose. Account consent
and a fresh Playground token are supplied by the developer through the UI.

## TV and verification

The web TV is `http://localhost:8082/tv`; approve its code at `/tv/connect` in the
same workspace. Goyal’s native Ubuntu/Vega instructions are in the
[Vega README](../apps/vega/README.md). Its backend must be a reachable HTTPS origin;
the simulator’s localhost is not the host computer. Native playback capabilities
are not identical to web WebRTC playback.

### Analyze Playground footage end to end

1. Connect a fresh Playground token using the drawer above. No access to the
   registered SmartDetector Ring app or someone else's cameras is required.
2. Open the discovered Playground camera's **Live view** in SmartDetector and
   select **Start live view**. Wait for actual video playback. Ring's Playground
   offers Package/Vehicle/Motion sample streams; availability depends on Ring.
3. The localhost action then captures footage and stops its live session before
   submitting analysis. This
   root-only action samples eight JPEG frames over seven seconds from that stream.
   The last frame remains visible while stopped, labeled not live. On reopening,
   the latest retained event preview is shown if one is available.
   It invokes the same AutoVision analysis, privacy settings, persistence,
   retention and event-delivery code used by real Ring events. Real inference
   consumes service quota and may incur charges; nothing runs automatically.
4. Open **History**, the camera's history, or the paired TV's recent events.
   Expect actual analysis and any available evidence previews. The event source
   is explicitly `ring-playground`, not a claimed production motion webhook.
5. Replace the token after expiry to continue with the same discovered camera IDs.

If video remains black or never plays, fix Ring/WebRTC connectivity first: an HTTP
201 only establishes signaling, not playable media. No media means no sample can
be analyzed. If AutoVision fails, the UI reports failure rather than inserting a
fabricated result. The button/API are unavailable in production SaaS/private mode,
for non-root users, and for normal production cameras.

This validates real media → AutoVision → saved event → TV, but not Ring's OAuth,
webhook signatures, queue delivery/retries, or production recorded-image retrieval.
Those still require a real authorized staging camera. Clicking Motion in Ring's
portal does not automatically post a signed motion webhook to SmartDetector. An [offline replay fixture](local-camera-replay.md) is an optional fallback,
not the official Playground; it is stopped/disabled by default.

```bash
npm run test:web
npm run typecheck
```

Adapter tests mock Ring responses and verify credential encryption/expiry, stable
IDs/history, live session limits, and local/root-only access. A fresh real token
still needs human end-to-end validation. If connection fails, first check Device
List in Ring and generate a fresh token. If the developer option is absent locally,
use root on localhost and rebuild Compose. Do not expose local default credentials
through a tunnel.
