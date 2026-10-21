```text
 SSSS M   M   A   RRRR  TTTTT DDDD  EEEEE TTTTT EEEEE  CCCC TTTTT  OOO  RRRR
S     MM MM  A A  R   R   T   D   D E       T   E     C       T   O   O R   R
 SSS  M M M AAAAA RRRR    T   D   D EEEE    T   EEEE  C       T   O   O RRRR
    S M   M A   A R R     T   D   D E       T   E     C       T   O   O R R
SSSS  M   M A   A R  RR   T   DDDD  EEEEE   T   EEEEE  CCCC   T    OOO  R  RR

CONNECTED SIGNALS. CLEAR INCIDENTS. FASTER RESPONSE.
```

# SmartDetector

[![CI](https://github.com/techcto/smartdetector/actions/workflows/ci.yml/badge.svg)](https://github.com/techcto/smartdetector/actions/workflows/ci.yml)
[![Open in GitHub](https://img.shields.io/badge/Open%20in-GitHub-181717?logo=github)](https://github.com/techcto/smartdetector)

SmartDetector connects smart-device events into a location-scoped security journal, with sampled visual evidence, AutoVision analysis, optional AI context, and a Fire TV review console. Customer device connections stay scoped to their location; installation-level developer credentials and the AutoVision service key are managed separately by root in **Account → Admin**.

[Website](https://smartdetector.com) · [Source](https://github.com/techcto/smartdetector) · [Deployment guide](devops/cloudformation/README.md)

<a href="https://smartdetector.com"><img src="assets/launch-website.svg" width="200" alt="Visit SmartDetector" /></a>
<a href="https://aws.amazon.com/marketplace/pp/prodview-l5jk7kn3222am"><img src="assets/launch-marketplace.svg" width="200" alt="Subscribe to SmartDetector on AWS Marketplace" /></a>
<a href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://smartdetector.s3.us-east-1.amazonaws.com/cloudformation/smartdetector.yaml&amp;stackName=smartdetector"><img src="assets/launch-aws.svg" width="200" alt="Launch SmartDetector with AWS CloudFormation" /></a>

## The Problem

Connected devices create separate streams of readings, video observations, and alarms. Operators need one place to understand which device reported what, whether a demonstration threshold was crossed, and what happened next. SmartDetector preserves the incident first; AI enrichment is optional rather than a prerequisite for detection.

## Hackathon Pitch

**Signals become incidents—not another disconnected dashboard.** SmartDetector combines device ingestion, deterministic demonstration rules, an incident timeline, AutoVision motion observations, and optional Amazon Bedrock explanations. Amazon SES connects the incident workflow to the people who need to respond.

Target: [Build, Ship, Shape: Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/), with **Fire TV as primary target and Ring as an additional integration target**. A project can win only one primary-track prize and one mini-challenge prize, not both track awards. See the [rules](https://amazonappdev2026.devpost.com/rules).

### Requirements audit — October 9, 2026

| Requirement | Status / remaining evidence |
| --- | --- |
| Working Fire TV app | Remote-friendly web client and administrator-approved device pairing implemented and browser-tested locally. Actual Fire TV runtime validation and distribution packaging remain required; desktop operation is not sufficient. |
| Ring runtime integration | Ring-initiated account linking, encrypted tokens/refresh, nonce validation, authorized camera discovery, signed webhooks, and the snapshot-to-AutoVision workflow implemented. Local automated/browser checks pass; real-account/API validation remains required. |
| AWS Builder optional challenge | Dedicated MCP AgentCore package, native CloudFormation runtime and signed AWS smoke client implemented. Verify a deployed Runtime invocation for submission evidence; local tests alone do not establish this. |
| Source access | AGPL-3.0 license exists; verify judge access and reproducible setup for the submitted revision. |
| Submission materials | Public English YouTube/Vimeo video under three minutes, product feedback for each API/SDK, changes during the contest window, and free judge access through judging remain to be supplied. |
| Open Source optional challenge | Independent `techcto/smartdetector-agentcore` package prepared. Submission needs its published contribution URL, repository URL, GitHub username and description of the contribution during the contest window. |

Deadline: October 23, 2026, noon PDT (3 PM EDT). Alexa remains configuration-only. The legacy AutoVision image-pair route is retained alongside the newer sampled-frame analysis workflow. Device pairing is locally tested, not a claim of Amazon certification or live deployment.

## Try SmartDetector

For developer registration, the official Ring Playground, local token connection, and production provider linking, see [Ring developer testing](docs/ring-developer-testing.md).

Privacy policy, signed-in deletion options, and 24-hour default event-image retention are documented in [Privacy and deletion](docs/privacy-and-deletion.md). Longer retention requires an active paid subscription and an explicit administrator choice.

Open [smartdetector.com](https://smartdetector.com) and sign in with an account supplied by the deployment owner. Hosted launch credentials are private and are **not** the local development defaults. In SaaS mode, signup creates a personal workspace; private installations disable public signup and billing.

1. Choose a workspace and connect an authorized device. For localhost camera testing, use Ring Playground in the Connect Ring drawer.
2. Inspect received device events and resulting observations. Discovery/live viewing alone does not generate analyzed events.
3. Root configures AutoVision in **Account → Admin**; deployment environment variables remain a fallback. AutoVision is a system service, not a user-configurable provider.
4. Validate configured analysis with authorized camera activity or an explicit API request using your own images.

The current hosted stack, `smartdetector-apphub-v011`, runs on the shared AppHub Fargate platform. The standalone CloudFormation template remains available for private installations. The stack-name suffix is historical; it is not a statement of the running release version.

## Core Capabilities

- Organization-scoped devices, observations, incidents, users, and settings.
- Deterministic demonstration rules for smoke, temperature, and CO readings; motion and person signals are also accepted.
- Asynchronous incident processing with optional Bedrock enrichment and configured SES email delivery.
- Organization-scoped provider connections with AES-GCM-encrypted secrets.
- AutoVision integration using the installation-level service API key.
- SaaS and private-install modes using the same application images.
- Stripe Checkout and signed webhook integration, activated only after keys and price IDs are configured.

## Turnkey Platform

| Layer | Included capability |
| --- | --- |
| Web | Next.js/React console, workspace selection, devices, incidents, users, settings |
| API | Next.js route handlers under `src/app/api`, authentication, tenant-scoped operations |
| Worker | SQS incident processing, optional Bedrock assessment, configured email notification |
| Persistence | DynamoDB, private S3 media storage, SQS and a dead-letter queue |
| Local runtime | Root Docker Compose, Dockerfiles in `devops`, DynamoDB Local and ElasticMQ |
| AWS runtime | ECS Fargate, ALB, IAM, CloudWatch, optional ACM HTTPS and Route 53 aliases |
| Delivery | GitHub Actions, versioned containers, S3 CloudFormation assets, Marketplace changesets |

SmartDetector has web, API, and worker images. AutoVision runs as a separate service and is reached through its configured URL.

## Local Development

For the complete Ubuntu backend + React preview + native Vega simulator setup, see [Ubuntu TV development](docs/ubuntu-tv-development.md).

Prerequisite: Docker with Compose. Use the wrapper to create the shared local network before starting the containers:

```bash
git clone https://github.com/techcto/smartdetector.git
cd smartdetector
cp .env.example .env
bash app.sh up
```

Open [http://localhost:8082](http://localhost:8082). Local username: `root`; local password: `smartdetector-local-change-me`. Change `SMARTDETECTOR_ROOT_PASSWORD` and `SMARTDETECTOR_SESSION_SECRET` before exposing the app outside your development machine. Local mode defaults to SaaS; AWS launch parameters choose the deployed mode independently.

```bash
curl --fail http://localhost:8082/api/health
docker compose ps
bash app.sh logs
# Stop containers without deleting data volumes:
bash app.sh down
```

Compose builds the web, API, and worker. DynamoDB Local and ElasticMQ replace the cloud database and queue locally. Data volumes survive container restarts and `docker compose down`; do not use `down -v` unless intentionally discarding local data. AWS notification sending and Bedrock require separate configuration; local startup does not prove those integrations are enabled.

For source checks, install the Node.js version declared in `package.json`, then run:

```bash
npm ci
npm run typecheck
npm run test:web
bash git.sh audit
```

## Installation-wide integration administration

Root manages developer apps at **Account → Admin** (`/admin`); non-root API access is denied. Ring and Alexa secrets are encrypted server-side and reads return only configured flags. Empty fields retain saved values. DynamoDB makes settings available to web/API/worker processes; without it, settings are process-local development data.

- **Ring:** system Client ID, Client Secret, HMAC signing key, and shared callback URLs. OAuth tokens and discovered cameras remain location-scoped. Shared signed webhooks resolve only the explicitly linked account destination and check the active connection before queuing work. Disconnect releases that routing entry. Legacy location-scoped callbacks remain available. Changing system app credentials affects Ring refresh/signature checks; keep the same Ring app when migrating existing links, or reconnect accounts after changing apps.
- **AutoVision:** system service URL/API key; deployment variables remain a fallback. Its synthetic test can consume quota/create activity.
- **Fire TV:** no customer secret. Optional Application ID is publishing metadata; displays use location-scoped pairing under Devices. It does not install or certify a native TV app.
- **Bedrock:** system model/inference profile and region are consumed by incident summaries. Authentication uses the AWS SDK credential chain/ECS task role, never keys entered in this UI. Authorize the selected model and inference-profile resources using reviewed CloudFormation changes; saving a model does not grant IAM access or verify invocation. Local Compose uses dummy AWS credentials and must be given an appropriate development identity separately for real Bedrock calls.
- **Alexa:** optional Skill ID and app metadata only, with encrypted optional OAuth secret. Skill runtime, account-linking endpoints, and certification remain unimplemented; the Admin form explicitly labels this setup-only.

These code changes require a release/deployment before the new forms and shared Ring endpoints appear on production. Do not change Ring console callbacks to routes absent from the currently deployed version.

Location administrators can open a device detail page and choose **Remove device**, then type `DELETE DEVICE`. This deletes that device's local saved events, inline image evidence, and queued Ring work, while preserving other devices and provider account connections. Removing a Fire TV display also revokes its access. A privacy tombstone blocks late/in-flight history writes and automatic Ring rediscovery; explicitly selecting **Connect device** restores a Ring camera for future events, without restoring deleted history. Copies already submitted to AutoVision have a separate retention/purge policy; Ring recordings and database backups are not deleted by this action.

## Developer Signup: Ring and Fire TV

These are Amazon developer accounts, separate from your SmartDetector workspace and AWS account. Never commit developer credentials, device footage, or customer identifiers.

### Ring

1. Visit the [Ring Developer portal](https://developer.ring.com/) and request developer registration using the [official getting-started guide](https://developer.amazon.com/docs/ring/get-started.html). Supply your contact, organization, and integration use case. Complete any verification requested by Amazon.
2. Once access is granted, register a SmartDetector test application. The portal supplies a client ID, client secret, and webhook HMAC signing key. Keep secrets in organization-scoped provider settings, not browser code or Git.
3. Follow the [local Ring testing guide](docs/ring-local-testing.md). SmartDetector implements Ring-initiated account linking: server-side code exchange, encrypted pending tokens, HMAC nonce verification, explicit administrator confirmation, and token refresh. An AWS access key is not a Ring token.
4. Sign in as root and open **Account → Admin → Ring developer app**. Save the Client ID, Client Secret, and HMAC key. Open Admin through your public HTTPS origin and copy all four shared callback URLs into Ring's matching staging/production app settings. Do not copy localhost location IDs into production URLs. Existing location-specific callbacks remain supported; existing secrets are not automatically copied between deployments.
5. Start a fresh account link from Ring's staging/testing workflow, share a camera, sign in to SmartDetector, and confirm the displayed destination location. Shared cameras sync into that location. A linked Ring account cannot silently move between locations: disconnect it from its original location before linking elsewhere. The optional partner-initiated OAuth allowlist is not required for this implemented flow.
6. Use a consenting test device/account, or the official hackathon Playground if your developer access includes it. Verify device discovery, signed event delivery, recorded snapshots, AutoVision analysis, and the resulting organization-scoped review. Mocks alone do not validate a real Ring integration.

Use the portal's actual account-linking flow; do not scrape consumer Ring credentials or share a personal password. API access and device/media permissions depend on the approved application and linked account.

### Fire TV

1. Create or sign into an [Amazon Developer account](https://developer.amazon.com/) and complete the developer profile. See [Get Started with Fire TV](https://developer.amazon.com/docs/fire-tv/get-started-with-fire-tv.html). Appstore submission and local testing are separate steps.
2. For the HTML5 client, use a compatible Fire OS Fire TV device and install Amazon Web App Tester. Follow [Amazon's installation and hosted-app testing instructions](https://developer.amazon.com/docs/fire-tv/webapp-app-tester.html), including ADB setup where required. Vega devices use a different development toolchain; do not assume the Fire OS tester works there.
3. When the TV client is built and running, load the service's `/tv` URL in the tester's **Hosted Apps** tab and choose **Test App**. For local development, use `http://<development-computer-LAN-IP>:8082/tv`, not `localhost`, and allow that port only on your trusted test network. Prefer HTTPS for hosted testing.
4. On the TV, select **Get pairing code**. On your phone/computer, open the same service's `/tv/connect`, sign in with your normal SmartDetector account, and select the intended organization in the console. Return to `/tv/connect`, enter the TV code, verify the display name and organization, and explicitly approve it as a workspace administrator. No separate TV account is needed.
5. The TV polls every five seconds and connects after approval. Codes expire after ten minutes; approved access lasts 24 hours. Removing or disabling the display's Fire TV provider connection revokes access. Re-pair after expiry. Never enter the root password, Ring secrets, or AutoVision key on the TV. The display cannot change incidents or invoke analysis.
6. Verify D-pad navigation, Select, Back, readable layouts, refresh behavior, expired/revoked access, and organization isolation on the actual device. A desktop-browser preview is useful but is not Fire TV runtime evidence.

For the Web App Tester route, choose a model explicitly listed as **Fire OS**, not Vega OS, in [Amazon's device specifications](https://developer.amazon.com/docs/device-specs/identify-fire-tv-devices.html). An older Fire TV Stick HD (2024), including a used/refurbished unit with its remote and power supply, is a budget candidate; verify price, availability, and exact generation before buying. You do not need a new television: the stick connects to an existing compatible HDMI display.

### Reproducible local TV demo

1. Start the local stack with `bash app.sh up` and open `http://localhost:8082` on your computer.
2. Open `/tv` in a second browser to preview the TV layout, request a code, and approve it at `/tv/connect` using your signed-in administrator session. On a physical TV, replace `localhost` with the computer's LAN IP and use the same origin for pairing approval.
3. Trigger authorized camera activity and confirm a received/analyzed event appears on the paired display. Local Playground discovery/live view is a separate media test and does not synthesize events.
4. Open the incident with Select, return with Back, and verify refresh. Remove the Fire TV connection in provider settings and confirm the display loses access.
5. Source checks: `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run test:web`. Pairing tests cover pending/expired codes, secret verification, concurrent approval, token tampering, tenant binding, and revocation. Real-device testing remains separate.

With the local service running, run `node devops/testing/tv-pairing-smoke.mjs` for a database-backed HTTP pairing/approval/revocation check. It is restricted to localhost, uses synthetic display data, and removes its test connection. Set `SMARTDETECTOR_TEST_USER` and `SMARTDETECTOR_TEST_PASSWORD` if you changed local credentials; never use production credentials for this test.

The custom pairing protocol is not a general-purpose OAuth authorization server. Both standalone and shared-platform deployments use the existing application table with TTL; no extra TV infrastructure is required.

### Before account or device access

Developers can run Docker Compose, inspect the console, and exercise synthetic sensor readings without Ring or Fire TV registration. Ring mock tests and desktop TV previews must be labeled as such. Real camera/API and Fire TV validation remain required before claiming those integrations are verified. The integration implementation is in progress; these instructions do not imply it has been released or deployed.

## API Examples

The web entry point routes `/api/*` to the API service. Replace local URLs with `https://smartdetector.com` for an authorized hosted request. Health is public; other endpoints require their documented credentials.

### Submit a synthetic sensor reading

Copy the workspace enrollment credential from Settings. The Bearer format is `<tenant-id>.<agent-id>.<enrollment-token>`; choose an opaque agent ID such as `demo-agent`. Supply the complete value as `SMARTDETECTOR_AGENT_TOKEN`:

```bash
curl --fail-with-body http://localhost:8082/api/v1/signals \
  -H "Authorization: Bearer $SMARTDETECTOR_AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"demo-sensor","type":"smoke","value":75,"event_id":"demo-smoke-001","simulated":true}'
```

A valid request returns 202 with `accepted:true` and, when a demonstration alarm rule matches, an `incidentId`. Reusing the event ID deduplicates incident creation within the organization/device/type scope. Without an event ID, alarm deduplication uses a minute bucket.

### Process an image pair through AutoVision

Configure the installation-level AutoVision environment variables first, then reuse the agent credential:

```bash
curl --fail-with-body http://localhost:8082/api/v1/vision \
  -H "Authorization: Bearer $SMARTDETECTOR_AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"demo-camera","demo":true}'
```

The API calls AutoVision and ingests returned motion observations. A missing system service key returns 409. In AWS, set `AutoVisionUrl`; locally or in custom deployments, set `SMARTDETECTOR_AUTOVISION_URL`. Both services must be running and reachable. Set SMARTDETECTOR_AUTOVISION_API_KEY in your ignored local .env file. In AWS, supply AutoVisionApiKeySecretArn, pointing to a Secrets Manager secret whose entire value is the API key; ECS injects it into web, API, and worker. The shared AutoVision credential is billed to its service account; SmartDetector still isolates event results by organization. Existing saved AutoVision provider records are no longer used.

## AWS Marketplace And Deployment

Subscribe through [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-l5jk7kn3222am) before launching images that require a subscription. The orange **LAUNCH AWS** button opens the standalone CloudFormation template; it does not subscribe you, select a network, or create a stack until you review and submit the parameters.

| Installation | Template |
| --- | --- |
| Standalone ALB and ECS cluster in an existing VPC | [`smartdetector.yaml`](devops/cloudformation/smartdetector.yaml) |
| Existing ALB/listener and ECS cluster, including AppHub | [`smartdetector-existing.yaml`](devops/cloudformation/smartdetector-existing.yaml) |

Provide VPC/subnets, root credentials, and a strong stable session secret. Private subnets need NAT or appropriate VPC endpoints. Use an ACM certificate covering `smartdetector.com`; DNS aliases must be owned by the application template or a separate CloudFormation DNS stack. Filled parameter files and secrets must remain private.

Set `DeploymentMode=saas` for multi-workspace signup and billing or `on-premise` for a private workspace with billing disabled. Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, and `STRIPE_SCALE_PRICE_ID`; configuration must be validated in Stripe test mode before live payments.

The default cloud delivery path is EventBridge → SQS → worker. `EventBridgeEnabled=false` selects direct SQS; the current AppHub deployment uses this option. Local delivery uses ElasticMQ. Public release templates are stored in the existing `smartdetector` bucket; private evidence/media storage is separate.

See [DevOps](devops/README.md) and the [CloudFormation guide](devops/cloudformation/README.md) for publishing accounts, GitHub configuration, containers, release tags, and Marketplace delivery changesets.

## Operations And Recovery

Install, update, and delete AWS infrastructure through formal CloudFormation templates and reviewed change sets—not individual resource APIs or manual console deletion. Keep the shared platform until all attached application stacks are removed.

After deployment, verify TLS, `/api/health`, healthy ALB targets, stable ECS tasks, login, a synthetic observation, its incident, and worker logs. Email and AI need independent configured-path verification. Preserve provider/session secrets across relaunches or stored credentials may become unreadable.

Review each resource's deletion/retention policy before removing a stack. Export private configuration, back up actual data separately, test replacement compute, and perform traffic cutover through CloudFormation. A configuration export is not a data backup; do not assume retained resources have been imported into a replacement stack.

## Scope And Safety

- Alexa+ remains a provider configuration schema only. Ring account linking and device selection have automated synthetic/mock coverage; final validation requires a consenting real Ring account and camera. The Fire TV web display supports locally tested read-only pairing but still needs physical-device validation and Appstore packaging.
- AutoVision currently returns image-pair motion, not smoke/fire image recognition.
- Sensor thresholds are demonstration rules, not certified alarms or life-safety equipment.
- Optional Bedrock failures do not prevent deterministic incident persistence.
- The dedicated AgentCore adapter and CloudFormation quickstart are included as a submodule; live AWS invocation and separate Marketplace product approval are deployment verification steps.
- Demonstrations, fixtures, and screenshots must use synthetic data only.

## License

First-party code is [AGPL-3.0-or-later](LICENSE). Commercial and hosted use are allowed under its terms; modified network versions must offer Corresponding Source as required by the license. Third-party components retain their own licenses. Separate commercial terms for maintainer-owned code can be discussed through [commercial licensing](COMMERCIAL-LICENSE.md).

## MCP and Amazon Bedrock AgentCore

The independent [SmartDetector MCP AgentCore package](submodules/smartdetector-agentcore/README.md) wraps this application's existing REST API with five read-only tools. It runs locally or in its own ARM64 AgentCore Runtime container, without duplicating the application or granting device-control permissions.

Clone with `git clone --recurse-submodules https://github.com/techcto/smartdetector.git`, or run `git submodule update --init --recursive` in an existing checkout. Log in and open **Settings → API keys** to create an organization-scoped key with `events:read` and `devices:read`. Browser sessions do not need API keys.

Set `SMARTDETECTOR_MCP_API_KEY` and a different random `SMARTDETECTOR_MCP_AUTH_TOKEN` in your ignored `.env`, then start the optional MCP container:

```bash
docker compose --profile agentcore up --build
```

Connect an MCP client to `http://localhost:8083/mcp` using the local MCP token as a bearer credential. Try: “List recent SmartDetector events, inspect the newest event, and explain the supporting observations without changing anything.” The [package quickstart](submodules/smartdetector-agentcore/README.md#aws-quickstart) covers reviewed CloudFormation installation, IAM-authenticated AWS access and the separate AgentCore Marketplace release variables. The new product needs its own product ID; the ECS product ID is not reusable.

Run `npm --prefix submodules/smartdetector-agentcore ci` and `node devops/testing/mcp-smoke.mjs` against a local app on port 8082 for the end-to-end REST/MCP check. Set `SMARTDETECTOR_TEST_USER` and `SMARTDETECTOR_TEST_PASSWORD` when using non-default local credentials. The test creates and revokes a temporary integration key. Optional `SMARTDETECTOR_TEST_SEED=1` also creates an explicitly synthetic sensor event retained in the local dashboard for review; it is never used against a remote deployment.

Developer issues and workarounds are recorded in the [friction log](docs/friction-log.md). An actual AWS Runtime invocation must be verified separately from local MCP tests before using it as deployment evidence.

## Current product workflow

| Area | Capability and boundary |
| --- | --- |
| Website and accounts | Public product pages/demo, SaaS signup, isolated organizations/locations, user management, profile and Settings. Private mode disables signup and plans. |
| Devices | Integration cards → provider detail → supported device families → connected camera detail. Ring accounts/connections are location-specific; discovery imports cameras shared with this app, not arbitrary cameras on a Ring account. |
| Event processing | Signed Ring notifications queue bounded media sampling; AutoVision supplies person/motion measurements and optional advisory object grounding. Device detail opens camera history; event detail shows sampled evidence, object boxes, timestamps and AI context. Availability depends on Ring grants/media and configured services. |
| Fire TV Console | Short-lived device-code pairing, revocable read-only access, camera cards, camera/event browsing, evidence-frame stepping, supported camera live view, refresh, and foreground notifications. Fire TV displays are excluded from the camera feed. No background overlay across unrelated TV apps is claimed. |
| Natural-language event search | Web History and TV accept object/camera/time queries over stored structured detections. This is validated filter extraction, not an unrestricted semantic or Bedrock search engine. |
| People | Location-scoped cards in History, names/family labels, full detail timelines, manual event assignments, opt-in face enrollment, and separate activity/notification choices. Automatic matching requires the configured AutoVision face service. |
| Root Admin | Global Ring developer credentials/shared callback URLs, AutoVision URL/key, Fire TV application metadata, Bedrock model/region, and Alexa setup metadata. Root-only secrets never belong in the normal customer connection flow. Alexa runtime remains unimplemented. |
| Privacy | Purge this location's events/images/activity associations while keeping devices and people profiles; remove a device and its saved history; revoke recognition or delete a person separately. External Ring/AutoVision history and backups are separate retention domains. |
| API, MCP and notifications | Scoped REST keys, MCP tools, separate AgentCore package/container, optional Bedrock context and configured SES incident emails. Future WhatsApp workflows are not described as a completed communication agent. |

Changes described here are source capabilities, not a claim that an unreleased local revision is already running on smartdetector.com. Hardware/Appstore validation, model configuration, release and deployment evidence must accompany the submitted revision.

### Search and voice input

Try **History → Search your saved events**, or the equivalent field in SmartDetector Console:

- “Show me every vehicle that entered the driveway today.”
- “Show me everyone at my front door today.”
- “Show me pets in the backyard yesterday.”

Use your actual camera names. `today` and `yesterday` use the browser's IANA timezone; `last 7 days` is a rolling window. Search scans up to 1,000 retained incident records/20 DynamoDB pages and returns at most 50 matches, with explicit truncation. “Entered” means observed on that camera, not verified crossing direction. “Everyone” means person detections, not a unique identity count. Unsupported negations/complex time expressions are rejected. Missing detections do not prove absence.

Select **TV keyboard / voice** to focus the input. Remote dictation works only if the Fire TV keyboard/runtime supplies it. The global Alexa button does not automatically deliver text to this web application; a custom Alexa skill is not required for keyboard dictation. **Use browser mic** offers opt-in SpeechRecognition where supported; otherwise type. Captured text is shown for review before Search. SmartDetector receives submitted text, not microphone audio; browser/OS recognition may use external servers. Actual Cube remote dictation and browser-mic availability must be checked on hardware.

### Household people, consent and privacy

1. In **History → People → Add person**, create a name/family label. This is a manual label, not face enrollment.
2. Open the person's full detail page. Assign a detected-person event by its ID to build a manually confirmed timeline. An event can contain multiple people; assignment means the named person is present, not that everyone in it is that person.
3. For a consenting household member, expand **Opt-in household face enrollment**, enter a retained event ID/frame number, select **Find faces in frame**, select the correct face and explicitly confirm consent. Enrollment replaces the person's reference and restores alerts to on. Never enroll strangers automatically.
4. In **History → People → Preferences**, control **Recognize me**, **Save my activity**, and **Notify about me**. Family status alone never mutes an alert. Unchecking recognition deletes the reference and restores normal notifications; disabling activity deletes activity links but can retain a recognition reference for alert filtering. Manual labeling can be used without biometric consent.
5. **Delete person** removes the profile/reference/activity links, not original camera events. **Settings → Purge data** removes retained location history/images/activity links while preserving device connections and profiles. Remove devices through their normal detail/disconnect workflow.

AutoVision runs YuNet to find faces and SFace to compute numeric embeddings inside its existing vision container. SmartDetector stores references encrypted with AES-GCM and location-bound authenticated encryption; embeddings never appear in People APIs, TV feeds, events, or browser enrollment responses. Model checksum IDs must match. Unknown-person embeddings are not saved as a stranger gallery. Automatic activity links have no copied images; they resolve evidence from the original event, and purge/device deletion removes orphaned associations. Consent/preference revisions prevent late matching work from recreating links after a preference change.

Matching uses cosine similarity plus separation from the second-best household candidate. Defaults are threshold `0.75`, margin `0.10`; these are conservative starting values, **not validated accuracy claims**. Override with `SMARTDETECTOR_FACE_MATCH_THRESHOLD` and `SMARTDETECTOR_FACE_MATCH_MARGIN` only after representative evaluation. Automatic personal alert suppression is disabled unless the operator explicitly sets `SMARTDETECTOR_FACE_ALERT_SUPPRESSION=validated` after calibration. It also requires every sampled frame's measured person boxes to have unambiguous, confidently matched faces. Unknown/uncertain people, missing faces, advisory-only coverage, extra hazards or service errors retain normal alerts. Temporal sampling and detector misses remain limitations; this must not replace safety systems. People timelines mark automatic matches separately from manual confirmations. Enrollment selection is bound to the exact frame/face and profile revision with a five-minute encrypted proof so an edited or stale selection cannot enroll a different face.

AutoVision's updated standard vision image includes checksum-pinned YuNet/SFace weights and license notices; rebuild and deploy that image alongside the new face API before using enrollment. No separate face container or customer model upload is needed. See [AutoVision's model setup](https://github.com/techcto/autovision#faces-yunet-sface-and-smartdetector). A face-reference match is fallible recognition evidence, not verified identity/liveness. Activity opt-out does not blur someone out of saved camera images; purge footage separately. Deployments need an appropriate notice/consent process for their use, and enrolling an account does not establish someone else's consent.

The initial enrollment stores one reference per person; enrolling again replaces it. With enrolled people, each analyzed event adds a separate face-measurement request and associated image-quota units/latency. Enrollment inspection and confirmation each remeasure the selected frame. No additional face request is made for event matching when this location has no enrolled references.

### Developer acceptance checklist

Future applications may reuse AutoVision face measurements for building security or attendance, with their own consent, galleries and decision rules. SmartDetector currently supplies a household event-review workflow, not access control or verified timekeeping.

- Run `npm run test:web`, `npm run lint`, `npm run build`; test without production credentials or customer footage.
- Create two locations; verify People, events, Ring connections, camera live view and TV tokens cannot cross locations.
- Use permitted test clips containing people/vehicles/pets and confusing negatives. Confirm structured boxes, previews, search results and frame stepping agree.
- Enroll a consenting tester with configured face models. Confirm the browser receives boxes only; verify known, unknown, obscured, multiple-person and model-mismatch cases. Record false matches/misses before enabling suppression.
- Disable activity, revoke recognition, purge history and remove a device; confirm references/associations/images follow their respective choices and new events still arrive.
- On a Fire TV Cube, verify pairing, D-pad/Back focus, camera live view, recent-event updates, typed search, keyboard dictation if available, denied browser microphone permission, and disconnect/revocation. Do not claim Cube hardware sensors or background TV notifications from desktop tests.
- Publish versioned images using the existing tag-release workflow; review CloudFormation changes before execution. Tests remain local verification rather than a new release-workflow gate.

## Native Vega TV client

For camera events without Ring access, see [Ring-free local replay](docs/local-camera-replay.md).
After `bash app.sh up`, run `npm run local:replay -- --sample intruder` and pair
the included web TV at `http://localhost:8082/tv`. Recorded mode uses saved sample
results and no AI/provider calls; `--live` explicitly runs the configured AutoVision service.

The native SmartDetector Console source and release pipeline are documented in [apps/vega/README.md](apps/vega/README.md). CI tests its API logic; version tags archive source and build ARMv7 packages in an isolated, version-pinned Vega SDK Docker environment. Device validation remains separate. Web/API Marketplace releases are independent of Amazon Appstore submission.

## Recorded homepage demos

The homepage uses four supplied demonstration videos shared with AutoVision: a doorbell hero, then dog-at-night, backyard visitor, and package-delivery tiles. Each has a cached AutoVision analysis under `public/demo/`, with input checksums, sampled JPEGs, returned object boxes, and advisory AI summaries. View analysis opens previous/next and thumbnail navigation; videos have no native player controls. Page loads do not invoke AI or create customer events. These are public demo assets, never connected customer footage. Only the named demo assets bypass login; location-scoped customer media remains authenticated.
# Hackathon testing guide

See [local setup, AutoVision integration, environment variables and verification](docs/hackathon-local-testing.md).

## Update a deployed version

Run `bash cmd.sh cft-update VERSION --stack YOUR_EXISTING_STACK` from this repository.
It prepares a CloudFormation change set, shows changes, asks for review/confirmation,
executes the exact approved plan, and waits for completion. Existing parameters and
credentials are preserved. See [update commands and offline tests](docs/cft-update.md).
