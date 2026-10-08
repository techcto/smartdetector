# SmartDetector

An event-driven situational-awareness console with devices, signals, and deterministic incident detection.

## Local stack

`bash app.sh up` starts the application and local AWS-compatible services. Open http://localhost:8082. Root username is `root`; the default local password is `smartdetector-local-change-me`. Local values can be overridden in `.env`. Do not use the local defaults in AWS. Signup creates an isolated personal workspace; root can create business workspaces and manage users.

Use **Run smoke sensor simulation** on the command center to demonstrate signal → device → deterministic incident. Settings exposes the workspace credential for `POST /api/v1/signals`. Device observations use `device_id`, `type`, and numeric `value`; an optional `event_id` deduplicates incident creation. Supported observations are smoke, temperature, CO, motion, and person. The current thresholds are demonstration rules, not a certified alarm system.

`docker compose logs -f` follows all services. `docker compose down` stops them while preserving data volumes. Database data persists across container restarts. Ring, Alexa+, Fire TV, are future integrations; the current web console and synthetic sensor demonstrate the core incident lifecycle.

## SaaS and private installs

Both use the same images. Set `DeploymentMode=saas` for multi-workspace signup, users, and billing, or `on-premise` for a private single-workspace app with billing disabled. Stripe checkout and signed webhooks require your test/live keys and price IDs. AWS templates support an optional ACM certificate.

See [DevOps](devops/README.md) and [CloudFormation](devops/cloudformation/README.md) for GitHub configuration, release images, S3 templates, and Marketplace changesets. Cloud resources and Marketplace publishing have not been deployed as part of local preparation.


Provider credentials and API keys are scoped to organizations. AutoVision keys are stored as hashes and revealed only at creation. SmartDetector encrypts provider secrets with AES-GCM. Set a stable provider/session secret and keep it unchanged across deployments.

In AutoVision Settings, create an API key; save it in SmartDetector Settings or Providers → AutoVision. Use **Test image detection** to process a synthetic image pair and add a motion signal to the active organization. Set `SMARTDETECTOR_AUTOVISION_URL` to the hosted endpoint in production, or the `AutoVisionUrl` CloudFormation parameter. Ring, Alexa+, and Fire TV currently have connection configuration schemas; their production adapters are pending implementation. Bedrock enrichment is optional and requires an allowed model ARN and AWS access.


Release deployment assets use the `smartdetector` S3 bucket. Private media storage is created separately per stack. Local incident work is delivered through ElasticMQ; AWS deployments use EventBridge → SQS → worker. Optional Bedrock failures never block deterministic incident creation.


The application domain is `smartdetector.com`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

## License

First-party project code is licensed under [AGPL-3.0-or-later](LICENSE). Commercial and hosted use are permitted under the AGPL; modified network versions must offer their Corresponding Source to users as required by the license. Third-party components retain their own licenses. See [commercial licensing](COMMERCIAL-LICENSE.md) for alternative terms available by separate agreement for maintainer-owned code.

