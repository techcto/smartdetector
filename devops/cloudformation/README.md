# SmartDetector deployment

Use `smartdetector.yaml` to create an ALB and ECS cluster in an existing VPC. Use `smartdetector-existing.yaml` to attach the app to an existing cluster and listener. Private subnets need NAT or the appropriate AWS VPC endpoints for image pulls, logs, DynamoDB, and SQS.

Select `DeploymentMode=saas` for hosted workspaces and Stripe billing or `on-premise` for a private installation. Set root credentials and a random session secret at launch. Supply an ACM certificate and configure DNS for HTTPS. The existing-listener template expects you to provide an HTTPS listener.

Example parameters contain placeholders only. Do not commit filled parameter files. These templates exceed CloudFormation's 51,200-byte inline limit; use the published HTTPS S3 template URL. Create a reviewed change set with `aws cloudformation create-change-set --stack-name smartdetector-test --change-set-name initial-install --change-set-type CREATE --template-url YOUR_PUBLISHED_HTTPS_S3_TEMPLATE_URL --parameters file://your-private.parameters.json --capabilities CAPABILITY_IAM`. Wait for creation, inspect it with `describe-change-set`, and execute only after reviewing resources, IAM changes and replacements. Update and delete applications through CloudFormation, not manual resource operations.

Stripe credentials use Secrets Manager in both templates. See [Stripe installation and rotation](../stripe/README.md#secrets-manager-standalone-and-shared-ingress-installs) for stack-managed credentials, an enterprise-owned secret ARN, optional customer-managed KMS, and reviewed rotation rollouts. Keep sandbox and live secrets separate. Price IDs remain ordinary configuration.

### Core secrets: install, migration and rotation

Both templates store `RootPassword`, `SessionSecret` and the effective
`ProviderSecret` in three separate retained Secrets Manager secrets. ECS loads
their values through `Secrets`; task definitions contain only ARNs. The
execution role can read only these specific secrets; the application task role
does not need Secrets Manager access. Outputs expose ARNs only. Existing ADM
secret injection and the optional AutoVision secret reference are unchanged.

For an existing installation, keep the current NoEcho parameter values using
`UsePreviousValue=true`. No random replacements or migration defaults are
introduced. If `ProviderSecret` was empty, the new provider secret contains the
exact current `SessionSecret`, preserving decryption of saved Ring credentials.
Review the change set: expect three new secrets plus task/service rollouts, not
replacement of application data stores. Removing plaintext values from the new
task definitions does not scrub historical task-definition revisions or revoke
any credentials that were previously exposed.

For new installs, supply real root credentials and a cryptographically random
session secret. An explicit, independently generated provider key is recommended.
`CoreSecretsKmsKeyArn` optionally selects a customer-managed KMS key; its key
policy must permit the execution role. The default is the AWS managed Secrets
Manager key. Private installs do not require Stripe or SES credentials.

For rotation, change the relevant NoEcho parameter through a reviewed change set
and increment `CoreSecretsRevision` to roll running tasks. Secret updates alone
do not refresh running ECS containers. Session-key changes invalidate sessions.
If `ProviderSecret` is empty, first pin it to the old session-key value before
changing `SessionSecret`; otherwise the provider key would change too.
Do not rotate the provider key until a separate re-encryption workflow is in
place; this install change deliberately preserves its value. RootPassword is a
bootstrap credential, not a password-reset API for an already-created account.
Use the application's password-management flow to change an existing user's
password. Automatic rotation is not configured for these application secrets.

Secrets are retained on stack deletion to avoid losing encryption keys. Review
retention and ownership explicitly before deleting or importing these resources.
Never commit populated parameter files or secrets, log values, or share them in
chat. Local development continues to use an uncommitted `.env`.

Both modes provision DynamoDB, a private media bucket, SQS with a dead-letter queue, an EventBridge bus, IAM roles, and CloudWatch logs. Evidence buckets are retained on stack deletion. Web/API/worker run as separate ECS services.


The application domain is `smartdetector.com`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

## SaaS email verification

New SaaS installations require `SesFrom` (an SES-verified sender in the deployment region) and `PublicOrigin` (the canonical HTTPS site origin). For the hosted site these are `noreply@smartdetector.com` and `https://smartdetector.com`. The templates wire SES sending permissions and configuration into web/API tasks, and reject a SaaS deployment with either value empty. The SES domain identity and its DNS verification must already be configured in that AWS account/region; these templates do not create or import it. SES production access is an account-level prerequisite, not something a release tag enables.

New public accounts, including users created by an administrator, must verify email ownership before signing in. Expiring verification links are consumed atomically; production SaaS never returns them in API responses. Failed email delivery is reported as an error, leaves the account unverified, and releases its resend reservation. Signup/resend throttling uses shared DynamoDB counters with TTL, plus a per-account resend cooldown. Private administrator-managed installations do not require email verification or SES.

`BlockedSignupDomains` is an optional comma-separated blocklist, including subdomains. Its default is empty so Gmail judges are not blocked. To reject Gmail registrations explicitly, set `gmail.com,googlemail.com` in a reviewed CloudFormation changeset. This controls new registrations and pending verification, not already-verified users. Email verification proves inbox access; it does not guarantee that a registrant is human or eliminate all abuse.

## Existing shared ingress

The existing template creates only app services, target groups, and hostname rules—not a new ALB or cluster. Supply Cluster, ListenerArn (HTTPS port 443), LoadBalancerSecurityGroup, VpcId and PrivateSubnets. HTTP-to-HTTPS redirection remains owned by the shared platform. Supply CertificateArn to attach the app certificate via SNI. Optional HostedZoneId requires LoadBalancerDnsName and LoadBalancerCanonicalHostedZoneId to create an alias. Do not overwrite existing DNS records. API priority must be lower than web priority and both unused on the listener. Defaults are 400/401. Keep the platform stack until all attached apps are removed.



## Contest runtime readiness

### Optional Amazon Device Messaging credentials

Supply `AdmClientId` and `AdmClientSecret` from the enabled Amazon Developer security profile in the normal application CloudFormation launch/update. Both are `NoEcho` parameters; leave both empty to disable ADM. A validation rule rejects partial credentials. The application stack creates the Secrets Manager secret with `client_id` and `client_secret` JSON fields. No separate credential stack, bridge template or manual resource creation is needed. Never commit populated parameter files or put credentials in native bundles.

When configured, ECS injects `SMARTDETECTOR_ADM_CLIENT_ID` and `SMARTDETECTOR_ADM_CLIENT_SECRET` into the worker only. Its execution role can read only this stack's secret. The worker uses Fargate platform 1.4.0 for JSON-key extraction. Web/API containers receive only the enabled flag, never either credential. The application task role gains no Secrets Manager access. Private subnets need access to Secrets Manager. The secret uses the AWS-managed encryption key and is retained on stack deletion; its ARN is the only credential-related output.

Keep previous parameter values during ordinary release updates. To rotate credentials, update the two parameters and roll worker tasks through a reviewed stack update; existing tasks retain their injected values. The app implements scoped registration, queued per-display ADM delivery and a native background receiver. Physical-TV playback and image presentation still require validation with the enabled security profile. See [TV notification setup](../../docs/tv-notifications.md).

AutoVision is a system service, not an organization provider. Set `AutoVisionUrl` and optional `AutoVisionApiKeySecretArn`. The ARN must identify a same-region Secrets Manager secret whose entire string value is the AutoVision API key, encrypted with the AWS-managed Secrets Manager key. ECS injects it into web/API/worker; the execution role receives only `secretsmanager:GetSecretValue` for that ARN. Customer-managed KMS keys need a separately reviewed CloudFormation permission update. No credentials belong in committed parameter files. Review the IAM policy addition and new task revisions before deploying.

This template deploys the web/API/worker platform, not a Fire TV client or Ring adapter. Fire TV device/simulator packaging and actual Ring integration must be implemented and demonstrated separately. See the requirements audit in the root README.

## AgentCore and publishing infrastructure

The [independent MCP package](../../submodules/smartdetector-agentcore/README.md#aws-quickstart) supplies a native AgentCore Runtime template and a separate publishing ECR repository template. Install either through a reviewed CloudFormation change set. The runtime attaches to the existing API by HTTPS and an organization-scoped read-only key; it does not replace the main ECS stack or application data.

Publishing workflows upload container images and template objects only. They require existing publishing repositories and public-read access to the `cloudformation/` assets prefix. Bucket policy, public access configuration and repository provisioning belong to CloudFormation. Import existing resources and preserve unrelated policy statements when bringing them under stack ownership; release scripts must not rewrite infrastructure policies.

## Ordered event index upgrade

Existing stacks must add the two key-only event indexes one at a time and backfill index attributes before deploying indexed readers. Follow [the ordered event migration](../../docs/incident-index-migration.md); preserve the current release and review each CloudFormation change set. Do not replace the table or replay AutoVision jobs.
