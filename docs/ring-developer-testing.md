# Ring developer testing

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

Discovery/live viewing does **not** automatically create analyzed events in the TV
journal. Real webhook intake and configured AutoVision analysis must be tested
separately. An [offline replay fixture](local-camera-replay.md) is an optional fallback,
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
