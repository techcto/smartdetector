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

Open [smartdetector.com](https://smartdetector.com) and sign in with an account supplied by the deployment owner. Hosted launch credentials are private and are **not** the local development defaults. In SaaS mode, signup creates a personal workspace; private installations disable public signup and billing.

1. Choose an organization and use **Run smoke sensor simulation** in the command center.
2. Inspect the device observation and resulting deterministic incident.
3. Root configures AutoVision in **Account → Admin**; deployment environment variables remain a fallback. AutoVision is a system service, not a user-configurable provider.
4. Use **Test image detection** to add a synthetic image-pair motion observation to the active organization.

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

## Developer Signup: Ring and Fire TV

These are Amazon developer accounts, separate from your SmartDetector workspace and AWS account. Never commit developer credentials, device footage, or customer identifiers.

### Ring

1. Visit the [Ring Developer portal](https://developer.ring.com/) and request developer registration using the [official getting-started guide](https://developer.amazon.com/docs/ring/get-started.html). Supply your contact, organization, and integration use case. Complete any verification requested by Amazon.
2. Once access is granted, register a SmartDetector test application. The portal supplies a client ID, client secret, and webhook HMAC signing key. Keep secrets in organization-scoped provider settings, not browser code or Git.
3. Follow the [local Ring testing guide](docs/ring-local-testing.md). SmartDetector implements Ring-initiated account linking: server-side code exchange, encrypted pending tokens, HMAC nonce verification, explicit administrator confirmation, and token refresh. An AWS access key is not a Ring token.
4. Open **Devices → Ring → Connect provider** and save the staging Client ID, Client Secret, and HMAC key. Open the same app through an HTTPS tunnel; the connection drawer generates all four location/connection-scoped URLs to copy into Ring's staging settings. The deployment administrator configures the AutoVision system service through environment variables.
5. Start account linking from Ring's staging/testing workflow, share a camera, sign in to SmartDetector, and confirm the connection. Choose a supported device type, discover the cameras authorized for that account, and connect one. The optional partner-initiated OAuth allowlist is not required for this implemented flow.
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
3. Run **Run smoke sensor simulation** in the command center. This is clearly labeled synthetic test data, not an actual smoke alarm. Confirm the resulting incident appears on the paired display.
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
