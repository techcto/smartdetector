# Stripe setup

SmartDetector uses its own Stripe account, separate from AutoVision, so each
app's webhook only receives its own customers' events. Plans match the app:
Dev is free (1 device), Starter is $49/month (5 devices), Scale is $199/month
(50 devices). Private installs (`SMARTDETECTOR_DEPLOYMENT_MODE=on-premise`) do
not use Stripe.

Offline preview (no credentials or network):

```sh
node devops/stripe/setup-plans.mjs
```

## Dev (local, Stripe test mode)

1. In the SmartDetector Stripe account, use a sandbox or Test mode and copy the
   `sk_test_…` (or restricted `rk_test_…`) key into `.env` as `STRIPE_SECRET_KEY`.
2. Create the plans: `node --env-file=.env devops/stripe/setup-plans.mjs --apply`.
   Copy the printed `STRIPE_STARTER_PRICE_ID` and `STRIPE_SCALE_PRICE_ID` into `.env`.
3. Forward webhooks and keep it running:
   `stripe listen --forward-to localhost:8082/api/billing/webhook --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted`.
   Copy the printed `whsec_…` into `.env` as `STRIPE_WEBHOOK_SECRET`.
   If the Stripe CLI is logged in to AutoVision, log in to the SmartDetector
   account first (`stripe login`) or pass `--api-key "$STRIPE_SECRET_KEY"`.
4. `SMARTDETECTOR_DEPLOYMENT_MODE=saas`, then `docker compose up -d`. Test with
   card `4242 4242 4242 4242`; verified webhooks, not the redirect, activate plans.

## Prod (live mode)

1. Release a tagged version so CI publishes images with the current code.
2. From that tag, run the live setup once, with the key from a secure source:
   `read -rs STRIPE_SECRET_KEY && export STRIPE_SECRET_KEY && node devops/stripe/setup-plans.mjs --apply --live`.
   It creates or reuses the live products and prices and prints the live price IDs.
3. Stripe Dashboard (Live): add the webhook endpoint
   `https://<smartdetector-domain>/api/billing/webhook` for the three events above,
   and configure the Customer portal.
4. Create a reviewed CloudFormation change set with `DeploymentMode=saas`,
   `StripeSecretKey`, `StripeWebhookSecret`, `StripeStarterPriceId` and
   `StripeScalePriceId` (keep other parameters at their previous values),
   inspect it, then execute.

The script uses stable IDs, lookup keys and idempotency keys, so reruns reuse
existing resources and only refresh product display; conflicting prices fail
for manual review. Live keys require `--apply --live`. Never commit keys,
webhook secrets or filled parameter files, and never mix test and live values.

## Secrets Manager (standalone and shared-ingress installs)

Both install templates inject Stripe credentials using ECS `Secrets`, not plain
task-definition environment values. Each stack uses one environment's keys;
production uses live keys, local development uses sandbox keys in an uncommitted
`.env`. Never put live keys in a local sandbox.

Choose one credential source:

- Stack-managed: supply both NoEcho `StripeSecretKey` and `StripeWebhookSecret`
  parameters. CloudFormation creates an encrypted, retained `StripeCredentials`
  secret. Its JSON keys are `secret_key` and `webhook_secret`. No placeholder or
  dummy credential is generated. Omitting both leaves billing unconfigured.
- Enterprise-managed: supply `StripeCredentialsSecretArn` for an existing
  same-account, same-region JSON secret with those keys, and leave both raw
  credential parameters empty. Provision that secret through your security
  team's CloudFormation stack. This avoids passing credential values through
  the application stack at all.

The output `StripeCredentialsSecretArn` exposes only the ARN. Optional
`StripeCredentialsKmsKeyArn` supports a customer-managed encryption key. Its key
policy must allow the execution role; decrypt permission is restricted to
Secrets Manager and that secret's encryption context. The default uses the AWS
managed Secrets Manager key. The execution role gets read access only to the
selected Stripe secret; the application task role does not receive that access.

Stripe price IDs are not secrets and remain normal CloudFormation parameters.
No publishable key is used by the current hosted Checkout integration.

### Rotation and rollout

For a stack-managed secret, update both credential parameters through a reviewed
CloudFormation change set. For an enterprise-managed secret, rotate through its
own owning stack/process. Increment `StripeCredentialsRevision` in the app stack
in the same rollout: this creates new task definitions and replaces running
tasks so they load `AWSCURRENT`. Changing a secret alone does not refresh ECS
containers. Coordinate Stripe webhook-key overlap during deployment and revoke
old API keys only after validating checkout, signed webhooks and the billing
portal. Secrets Manager does not automatically rotate Stripe-issued keys.

Stack-managed credentials have Retain policies: deleting the app preserves the
secret. Review retained secrets explicitly; do not switch ownership casually.
Keep production and sandbox in separate secrets, stacks and access policies.

Session-signing, provider-encryption and root bootstrap secrets also use Secrets
Manager in both install templates; see the CloudFormation README for migration
and rotation. Preserve exact existing values. Changing the provider key without
re-encrypting stored Ring credentials breaks existing connections. ADM already
uses Secrets Manager; AutoVision supports an existing secret ARN.
Ring connection tokens remain application-encrypted records, not Stripe secrets.
