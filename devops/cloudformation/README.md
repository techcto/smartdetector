# SmartDetector deployment

Use `smartdetector.yaml` to create an ALB and ECS cluster in an existing VPC. Use `smartdetector-existing.yaml` to attach the app to an existing cluster and listener. Private subnets need NAT or the appropriate AWS VPC endpoints for image pulls, logs, DynamoDB, and SQS.

Select `DeploymentMode=saas` for hosted workspaces and Stripe billing or `on-premise` for a private installation. Set root credentials and a random session secret at launch. Supply an ACM certificate and configure DNS for HTTPS. The existing-listener template expects you to provide an HTTPS listener.

Example parameters contain placeholders only. Do not commit filled parameter files. Create a reviewed change set with `aws cloudformation create-change-set --stack-name smartdetector-test --change-set-name initial-install --change-set-type CREATE --template-body file://devops/cloudformation/smartdetector.yaml --parameters file://your-private.parameters.json --capabilities CAPABILITY_IAM`. Wait for creation, inspect it with `describe-change-set`, and execute only after reviewing resources, IAM changes and replacements. Update and delete applications through CloudFormation, not manual resource operations.

Both modes provision DynamoDB, a private media bucket, SQS with a dead-letter queue, an EventBridge bus, IAM roles, and CloudWatch logs. Evidence buckets are retained on stack deletion. Web/API/worker run as separate ECS services.


The application domain is `smartdetector.com`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

## Shared ALB and ECS cluster

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
