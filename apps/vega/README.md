# SmartDetector Console for Vega

Native React Native client, separate from the Next.js web console. Uses the Amazon SDK's React Native 0.83 `helloWorld` template, not a WebView or Android APK.

Implemented source: short-lived pairing, location-scoped read-only feed, device browsing, event/frame review with detection overlays, saved-event text search, foreground alerts, remote focus and Back navigation. Fire TV displays are excluded from camera browsing. Data purged on the server disappears on refresh. The shared screens include a responsive phone layout with full-width cards, wrapped controls and narrower spacing.

Native compilation and packaging have succeeded locally for ARMv7, x86_64 and aarch64. Remote navigation, image rendering and actual pairing still need simulator/hardware validation. Native Ring live video, direct remote microphone access, background/system notification overlays and persistent secure token storage are not implemented. Tokens are memory-only: pair again after restarting. Local disconnect clears memory; revoke the display through Devices → Fire TV on the website. Native image caching behavior still needs device privacy validation.

## Build and test

1. Install [Amazon Vega SDK 0.24 / Vega Studio](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk). Use its supported Node/toolchain environment and React Native 0.83 template.
2. From the repository root run `npm --prefix apps/vega test`, then `npm --prefix apps/vega run build:app`.
3. The preparation script generates the official template in `.generated/project`, validates its runtime assumptions and overlays this client's source. Runtime definitions remain SDK-owned; app branding, package version and Metro's `.mjs` extension support are configured by the preparation script. If the template changes, it fails for review. Generated files are disposable; do not edit them as source.
4. For a tagged build set `SMARTDETECTOR_RELEASE_VERSION` to the tag without `v`. `SMARTDETECTOR_VEGA_BUILD_NUMBER` supplies a positive build number; releases use the GitHub workflow run number, while local builds default to 1. For local backend testing set `SMARTDETECTOR_VEGA_ORIGIN` to your HTTPS tunnel origin; HTTP and embedded credentials are rejected. No app secrets belong in this build. The manifest declares Amazon's optional virtual-keyboard service for text search.
5. Use the SDK simulator first. For the Fire TV Stick 4K 3rd Gen (Vega OS 2.0, 32-bit), use the **ARMv7 `.vpkg`**, not an APK or simulator package.

Follow [Amazon's device testing instructions](https://developer.amazon.com/docs/vega/0.24/run-apps): enable Developer Mode and complete CLI developer-account authentication, then `vega device list` and `vega device install-app --packagePath <armv7-package.vpkg>`. Launch using the component ID in the generated manifest/app.json. Consumer unknown-source restrictions are distinct from this developer workflow. Configure Vega Studio's development server port away from 8081 if AutoVision is using that port.

On TV choose Get pairing code. On your phone open `https://smartdetector.com/tv/connect`, sign in, select the correct location and approve the display. Validate revocation, location isolation, purge refresh, network failures, foreground/background behavior, frame overlays and every Back transition on real hardware before submission. Search uses retained structured event evidence, not arbitrary full-video semantic indexing.

## Release management

Every normal CI run tests the dependency-free client logic. `release-vega.yml` runs on version tags and publishes a **source archive** workflow artifact independently of ECS/AWS Marketplace releases. This is not an installable app.

Package jobs build a version-pinned SDK Docker image on a GitHub-hosted Ubuntu runner, then run client tests and package compilation inside it. Tag releases and manual releases build and retain ARMv7 `.vpkg` workflow artifacts for 90 days; missing output fails the job. No self-hosted runner or repository opt-in variable is required. Amazon Appstore submission remains manual and separate from AWS Marketplace container delivery. Capture the SDK version, package checksum and device test results with each submitted build.

## Docker build

The included Dockerfile follows [Amazon's supported headless CI approach](https://developer.amazon.com/docs/vega/0.24/continuous-integration), using Ubuntu 22.04, Node 22.22.0 and SDK 0.24.12112 (CLI 1.4.4 observed at installation). It excludes the virtual device; simulator and physical-device validation run separately. The container mounts only this app directory read-only, plus generated/build output storage, not deployment credentials or the rest of the repository. Post-install SDK telemetry is opted out through its documented config file.

From the repository root:

```sh
SMARTDETECTOR_RELEASE_VERSION=0.1.0 bash apps/vega/scripts/build-docker.sh
```

The SDK's Program Materials license applies; do not publish the proprietary builder image as part of this open-source repository. No application credentials are baked into the image. A dedicated Docker volume keeps generated dependencies on Linux storage (important on Windows/WSL). Exported packages, checksums, SDK version, security audit and resolved dependency lock appear under `apps/vega/build`. Native dependencies are installed with `npm ci` using the committed `native-package-lock.json`, then type-checked against Vega's React Native definitions.

Security review remains required before Appstore publication: the initial official SDK template resolved 75 total audit findings (60 high), or 42 findings (28 high) with `--omit=dev` on October 10, 2026. `dependency-overrides.json` pins patched lodash, AJV 8, minimatch 3/9, fast-xml-parser, TOML and uuid releases without replacing the SDK's React Native 0.83 or Kepler 4 runtime. The patched production tree has 34 findings (27 high, 7 moderate), propagated from two root advisories: braces stack exhaustion and sprintf-js unbounded precision. Neither has a published patched release in the registry checked that day. Do not describe the package as vulnerability-free. Many reported paths include build tooling classified as production dependencies; runtime exploitability has not been established. Build only trusted source/manifests in the isolated container, and do not pass customer-provided glob patterns or format strings to these tools. The build exports the audit and emits a release warning. A successful development package build is not security clearance or an Appstore-ready claim.

## Browser and mobile UI preview

```sh
docker compose -f apps/vega/compose.preview.yml up -d --build
```

Open **http://localhost:8090**. Choose **Get pairing code**, then **Open pairing approval** and sign in to SmartDetector. Select the intended location and approve the displayed code. Real shared cameras and retained events load after pairing. Empty states offer **Add device**, **Add Ring connection**, or **Manage camera connection**; the console never fabricates footage or events. Resize for the mobile layout. Tab/Enter navigate browser controls; Escape goes Back. `SMARTDETECTOR_NATIVE_PREVIEW_PORT` overrides the host port. Disconnect is under **Console settings**, with a separate confirmation that defaults to keeping the connection.

This uses the **same App.tsx screens through React Native Web**, not a WebView wrapper or a Vega virtual device. The localhost server proxies only pairing, scoped feed and search requests to **https://smartdetector.com**, with TLS verification and without browser cookies. Display authorization stays in memory and is required to read real data. There are no demo toolbar controls or synthetic API responses. CI blocks API network requests and checks onboarding, failure handling, absence of fake devices, and desktop/phone overflow; it does not access production customer data. Physical-device capabilities still require hardware testing.

To stop only this preview: `docker compose -f apps/vega/compose.preview.yml stop`.

## Phone notification priority (not implemented)

### Fire TV web-console parity

Voice search: **TV keyboard / voice** focuses the native search field and opens the configured system keyboard. Use dictation only if that keyboard offers it; direct Alexa-button audio/transcript capture is not implemented or claimed. The React Native Web version offers **Use browser mic** where SpeechRecognition exists, explicit Stop, permission/error handling and a 15-second limit. Transcripts populate an editable query; users press Search to submit. No audio is uploaded to or stored by SmartDetector, although browser/OS speech providers may process audio. Voice capture stops on backgrounding/disconnect/unmount. Hardware dictation must be verified on the target Fire TV.

The shared native UI carries over location-scoped pairing/feed/search, camera cards (excluding TV displays), a device's latest evidence and event history, frame stepping and detection boxes, event-to-device navigation, manual/automatic refresh, foreground notifications and hierarchical Back. Disconnect now lives in Console settings behind a confirmation with Keep connected first. Setup uses real data only and actionable empty states. Native live-view requests currently open the existing camera page in the authenticated web console; WebRTC playback and microphone capture have **not** been ported into Vega. Browser/mobile layouts are not installed iOS/Android apps, and native background phone push remains future work. Physical remote focus, keyboard dictation and install behavior must be checked on hardware before claiming feature parity.

The first iOS/Android capability should be background notifications: a location/device, detected activity, optional privacy-safe thumbnail and an authenticated deep link into event review. Do not infer identity from a person box; only show a name from a supported household match. Respect location membership, alert preferences and family opt-outs on the server, including existing `notify:false` suppression. Avoid sending raw face templates or embedding private media in publicly accessible push URLs. Removing a device, revoking access or purging evidence must also invalidate notification/deep-link access.

Native iOS/Android projects, APNs/FCM credentials, permission prompts, push-token registration/revocation and delivery workers still need implementation. The responsive preview is not a shipped mobile app, and foreground Vega alerts are not phone push notifications. Keep platform integrations separate from shared screens and the read-only TV pairing credential.
