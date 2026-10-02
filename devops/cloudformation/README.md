# SmartDetector deployment

Use `smartdetector.yaml` to create an ALB and ECS cluster in an existing VPC. Use `smartdetector-existing.yaml` to attach the app to an existing cluster and listener. Private subnets need NAT or the appropriate AWS VPC endpoints for image pulls, logs, DynamoDB, and SQS.

Select `DeploymentMode=saas` for hosted workspaces and Stripe billing or `on-premise` for a private installation. Set root credentials and a random session secret at launch. Supply an ACM certificate and configure DNS for HTTPS. The existing-listener template expects you to provide an HTTPS listener.

Example parameters contain placeholders only. Do not commit filled parameter files. Deploy with `aws cloudformation create-stack --stack-name smartdetector-test --template-body file://devops/cloudformation/smartdetector.yaml --parameters file://your-private.parameters.json --capabilities CAPABILITY_IAM`.

Both modes provision DynamoDB, a private media bucket, SQS with a dead-letter queue, an EventBridge bus, IAM roles, and CloudWatch logs. Evidence buckets are retained on stack deletion. Web/API/worker run as separate ECS services.


The application domain is `smartdetector.com`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

