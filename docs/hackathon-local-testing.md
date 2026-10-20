# Hackathon local testing

Synthetic admin sample data is enabled only with `NODE_ENV=development` and
`SMARTDETECTOR_DEPLOYMENT_MODE=on-premise`, using in-memory or local DynamoDB storage.
SaaS mode and all production builds (including local production previews) never seed it.
Changing this gate does not delete previously seeded data. The real-agent test fixture,
where available, uses its separate explicit enrollment workflow rather than synthetic logs.

Requirements: Docker with Compose; Node.js 26 for host checks. From this repo:

```sh
# First setup only; do not overwrite an existing .env.
cp -n .env.example .env
git submodule update --init --recursive
bash app.sh up
curl --fail http://localhost:8082/api/health
```

Open http://localhost:8082. The example username is `root`; the example password
is `smartdetector-local-change-me`. Change root/session secrets in your ignored
`.env`. Docker Compose reads this file for interpolation; it only forwards
variables declared in the service environment. Re-run `bash app.sh up` after
configuration/source changes. Existing local volumes survive `bash app.sh down`.
Do not use `down -v` unless intentionally deleting local data.

## Connect real AutoVision

Start AutoVision using its own local guide, on the shared
`application-platforms-local` Docker network created by `app.sh`.
Create a dedicated AutoVision API credential and configure SmartDetector's
installation integration/ignored `.env` with:

```dotenv
SMARTDETECTOR_AUTOVISION_URL=http://autovision-api:3001
SMARTDETECTOR_AUTOVISION_API_KEY=YOUR_LOCAL_AUTOVISION_SERVICE_KEY
```

The container URL is not a browser URL. Use http://localhost:8081 to open
AutoVision. Select matching organization/location settings and explicitly enable
enhanced inspection when testing that feature. Check actual returned frame counts
and tool traces; Ring's supplied samples do not become extra captured frames.
Cached homepage demonstrations do not prove a new live analysis occurred.

## Bedrock and real provider connections

The default Compose stack uses dummy AWS credentials for local DynamoDB/SQS/S3;
notifications are log-only. It does **not** forward `BEDROCK_MODEL_ID` or mount
real AWS credentials. Setting that variable in `.env` alone will not turn on
SmartDetector's own Bedrock summaries in Docker.

For the hackathon, enable real vision inference in AutoVision using its dedicated
Bedrock override; SmartDetector consumes that API. SmartDetector's separate
installation summary code uses `BEDROCK_MODEL_ID`/installation settings and the
AWS SDK identity. Host testing can use an approved short-lived AWS profile;
production uses the ECS task role with scoped CloudFormation IAM. Do not replace
all local-service credentials with production keys.

Ring account linking requires its configured developer app, authorized cameras
and public HTTPS callbacks: follow [Ring local testing](ring-local-testing.md).
An AWS profile does not authenticate Ring. Never use production passwords or
customer footage for an unattended local test.

## Checks and submission evidence

```sh
npm ci
npm run typecheck
npm run test:web
npm run lint
node devops/testing/tv-pairing-smoke.mjs
```

The pairing smoke test is localhost-only; configure its documented test username
and password if changed. Open `/tv` in a second browser to test pairing and
navigation. A desktop browser pass does not certify Vega/native TV distribution.
Record a real event's retained previews, AutoVision OpenCV version/tool trace,
review recommendation and consuming-app behavior. Missing integrations should
show unavailable/empty states, not synthetic events or successful delivery.
