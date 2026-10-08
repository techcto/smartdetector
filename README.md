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

SmartDetector is an open-source incident console that turns device observations into organization-scoped incidents, optional AI explanations, and email alerts. It connects to AutoVision for image-pair motion detection and keeps provider credentials inside each organization.

[Website](https://smartdetector.com) · [Source](https://github.com/techcto/smartdetector) · [Deployment guide](devops/cloudformation/README.md)

<a href="https://smartdetector.com"><img src="assets/launch-website.svg" width="200" alt="Visit SmartDetector" /></a>
<a href="https://aws.amazon.com/marketplace/pp/prodview-l5jk7kn3222am"><img src="assets/launch-marketplace.svg" width="200" alt="Subscribe to SmartDetector on AWS Marketplace" /></a>
<a href="https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://smartdetector.s3.us-east-1.amazonaws.com/cloudformation/smartdetector.yaml&amp;stackName=smartdetector"><img src="assets/launch-aws.svg" width="200" alt="Launch SmartDetector with AWS CloudFormation" /></a>

## The Problem

Connected devices create separate streams of readings, video observations, and alarms. Operators need one place to understand which device reported what, whether a demonstration threshold was crossed, and what happened next. SmartDetector preserves the incident first; AI enrichment is optional rather than a prerequisite for detection.

## Hackathon Pitch

**Signals become incidents—not another disconnected dashboard.** SmartDetector combines device ingestion, deterministic demonstration rules, an incident timeline, AutoVision motion observations, and optional Amazon Bedrock explanations. Amazon SES connects the incident workflow to the people who need to respond.

For the [AWS CDS Agentic AI Partner Hackathon](https://aws-cds-partner.devpost.com/), demonstrate the actual SES notification call with configured AWS permissions and verified sending identities. Local log-mode messages are not proof of production delivery. Include the architecture, a working demonstration, and judge-access instructions; do not claim future integrations as completed features.

## Try SmartDetector

Open [smartdetector.com](https://smartdetector.com) and sign in with an account supplied by the deployment owner. Hosted launch credentials are private and are **not** the local development defaults. In SaaS mode, signup creates a personal workspace; private installations disable public signup and billing.

1. Choose an organization and use **Run smoke sensor simulation** in the command center.
2. Inspect the device observation and resulting deterministic incident.
3. Create an AutoVision API key, then save it in Settings or Providers → AutoVision.
4. Use **Test image detection** to add a synthetic image-pair motion observation to the active organization.

The current hosted stack, `smartdetector-apphub-v011`, runs on the shared AppHub Fargate platform. The standalone CloudFormation template remains available for private installations. The stack-name suffix is historical; it is not a statement of the running release version.

## Core Capabilities

- Organization-scoped devices, observations, incidents, users, and settings.
- Deterministic demonstration rules for smoke, temperature, and CO readings; motion and person signals are also accepted.
- Asynchronous incident processing with optional Bedrock enrichment and configured SES email delivery.
- Organization-scoped provider connections with AES-GCM-encrypted secrets.
- AutoVision integration using the configured organization API key.
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

Save the organization's AutoVision key in Providers first, then reuse the agent credential:

```bash
curl --fail-with-body http://localhost:8082/api/v1/vision \
  -H "Authorization: Bearer $SMARTDETECTOR_AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"demo-camera","demo":true}'
```

The API calls AutoVision and ingests returned motion observations. A missing provider key returns 409. In AWS, set `AutoVisionUrl`; locally or in custom deployments, set `SMARTDETECTOR_AUTOVISION_URL`. Both services must be running and reachable.

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

- Ring, Alexa+, and Fire TV currently have provider configuration schemas; their production adapters are not implemented.
- AutoVision currently returns image-pair motion, not smoke/fire image recognition.
- Sensor thresholds are demonstration rules, not certified alarms or life-safety equipment.
- Optional Bedrock failures do not prevent deterministic incident persistence.
- AgentCore runtime integration is not implemented in this repository.
- Demonstrations, fixtures, and screenshots must use synthetic data only.

## License

First-party code is [AGPL-3.0-or-later](LICENSE). Commercial and hosted use are allowed under its terms; modified network versions must offer Corresponding Source as required by the license. Third-party components retain their own licenses. Separate commercial terms for maintainer-owned code can be discussed through [commercial licensing](COMMERCIAL-LICENSE.md).

