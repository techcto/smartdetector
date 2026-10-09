# SmartDetector deployment

Use `smartdetector.yaml` to create an ALB and ECS cluster in an existing VPC. Use `smartdetector-existing.yaml` to attach the app to an existing cluster and listener. Private subnets need NAT or the appropriate AWS VPC endpoints for image pulls, logs, DynamoDB, and SQS.

Select `DeploymentMode=saas` for hosted workspaces and Stripe billing or `on-premise` for a private installation. Set root credentials and a random session secret at launch. Supply an ACM certificate and configure DNS for HTTPS. The existing-listener template expects you to provide an HTTPS listener.

Example parameters contain placeholders only. Do not commit filled parameter files. Create a reviewed change set with `aws cloudformation create-change-set --stack-name smartdetector-test --change-set-name initial-install --change-set-type CREATE --template-body file://devops/cloudformation/smartdetector.yaml --parameters file://your-private.parameters.json --capabilities CAPABILITY_IAM`. Wait for creation, inspect it with `describe-change-set`, and execute only after reviewing resources, IAM changes and replacements. Update and delete applications through CloudFormation, not manual resource operations.

Both modes provision DynamoDB, a private media bucket, SQS with a dead-letter queue, an EventBridge bus, IAM roles, and CloudWatch logs. Evidence buckets are retained on stack deletion. Web/API/worker run as separate ECS services.


The application domain is `smartdetector.com`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

## Shared ALB and ECS cluster

The existing template creates only app services, target groups, and hostname rules—not a new ALB or cluster. Supply Cluster, ListenerArn (HTTPS port 443), LoadBalancerSecurityGroup, VpcId and PrivateSubnets. HTTP-to-HTTPS redirection remains owned by the shared platform. Supply CertificateArn to attach the app certificate via SNI. Optional HostedZoneId requires LoadBalancerDnsName and LoadBalancerCanonicalHostedZoneId to create an alias. Do not overwrite existing DNS records. API priority must be lower than web priority and both unused on the listener. Defaults are 400/401. Keep the platform stack until all attached apps are removed.



## Contest runtime readiness

AutoVision is a system service, not an organization provider. Set `AutoVisionUrl` and optional `AutoVisionApiKeySecretArn`. The ARN must identify a same-region Secrets Manager secret whose entire string value is the AutoVision API key, encrypted with the AWS-managed Secrets Manager key. ECS injects it into web/API/worker; the execution role receives only `secretsmanager:GetSecretValue` for that ARN. Customer-managed KMS keys need a separately reviewed CloudFormation permission update. No credentials belong in committed parameter files. Review the IAM policy addition and new task revisions before deploying.

This template deploys the web/API/worker platform, not a Fire TV client or Ring adapter. Fire TV device/simulator packaging and actual Ring integration must be implemented and demonstrated separately. See the requirements audit in the root README.

## AgentCore and publishing infrastructure

The [independent MCP package](../../submodules/smartdetector-agentcore/README.md#aws-quickstart) supplies a native AgentCore Runtime template and a separate publishing ECR repository template. Install either through a reviewed CloudFormation change set. The runtime attaches to the existing API by HTTPS and an organization-scoped read-only key; it does not replace the main ECS stack or application data.

Publishing workflows upload container images and template objects only. They require existing publishing repositories and public-read access to the `cloudformation/` assets prefix. Bucket policy, public access configuration and repository provisioning belong to CloudFormation. Import existing resources and preserve unrelated policy statements when bringing them under stack ownership; release scripts must not rewrite infrastructure policies.
