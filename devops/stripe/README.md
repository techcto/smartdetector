# Stripe setup

SmartDetector uses its own Stripe account, separate from AutoVision, so each
app's webhook only receives its own customers' events. Plans match the app:
Free includes 10 devices, Starter is $49/month (25 devices), Scale is $99/month
(50 devices). Both paid plans bill additional registered devices at $2/device/month.
Private installs (`SMARTDETECTOR_DEPLOYMENT_MODE=on-premise`) do
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

Local Compose pins `SMARTDETECTOR_STRIPE_MODE=sandbox` and rejects live keys.
Its production-built containers can exercise email verification locally using
displayed log-mode links only when the explicit replay flag, local AWS dummy
credentials, exact local table and loopback/Docker DynamoDB emulator endpoint
all match. Deployed AWS SaaS does not meet that boundary and still requires real
SES; setting the replay flag alone never enables a production verification bypass.
Run `node devops/stripe/local-webhooks.mjs` to forward sandbox subscription events
to the loopback-only web port (8082 by default). It loads the ignored local `.env`,
refuses live keys, checks the signing secret and redacts credential output. The
official Stripe CLI must be installed or available at ignored `bin/stripe`.
Keep this forwarding process running while testing Checkout. Its signing secret
is specific to local forwarding, not the live Dashboard webhook endpoint.

`STRIPE_SECRET_KEY=sk_test_... node --import tsx devops/stripe/sandbox-check.ts`
runs isolated sandbox-only request, quantity, proration, renewal and cancellation
checks. It refuses production mode or an app table, uses test clocks and cleans
up simulation resources; reusable sandbox products/prices remain. Never use a
live key, production database or real card to run this check.

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

## Device billing (new subscriptions)

The setup script creates new `*_usd_monthly_devices_v2` licensed graduated prices:
the first tier is the monthly base fee with 25/50 included devices, followed by
$2 per additional device. It does not modify legacy flat-rate prices or silently
change existing subscriptions. Update the two price-ID parameters to the IDs
printed by the script; old IDs are rejected by the new checkout code.

Customers explicitly accept automatic device billing before checkout; Stripe
Checkout repeats the rate and stores the terms version in subscription metadata.
All registered devices in the selected workspace count, including offline devices
and Fire TV displays, until removed. Historical events do not count. For example,
30 Starter devices cost $59/month; 60 Scale devices cost $119/month, before taxes
and discounts. Zero registered devices still incurs the plan's base fee.

The existing worker reconciles current inventory about once per minute. It uses
a shared DynamoDB lease and Stripe idempotency keys, updates only consented v2
subscription quantities, and retries failures on later passes. Stripe prorates
additions/removals onto the next invoice (`create_prorations`), rather than making
an immediate charge for every device change. Stripe invoices and collection
settings control actual automatic payment, including any required authentication.
Existing unpaid or canceled subscriptions are not quantity-updated. A canceled
subscription does not become chargeable merely because devices remain registered.

Before production rollout: provision matching v2 prices in the correct Stripe
environment; set both price IDs, live credentials and live webhook signing key
through the reviewed stack configuration/rotation process; verify Customer
Portal configuration references the intended plans and does not permit manual
quantity changes. Test additions, removals, retries and invoice previews in a
sandbox first. Do not use real charges as a smoke test. Existing customers need
an explicit migration/consent flow before v2 automatic overages apply.

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
CloudFormation `StripeMode` defaults to `live`; isolated cloud sandbox stacks
must explicitly select `sandbox`. The application refuses a key/mode mismatch.

Session-signing, provider-encryption and root bootstrap secrets also use Secrets
Manager in both install templates; see the CloudFormation README for migration
and rotation. Preserve exact existing values. Changing the provider key without
re-encrypting stored Ring credentials breaks existing connections. ADM already
uses Secrets Manager; AutoVision supports an existing secret ARN.
Ring connection tokens remain application-encrypted records, not Stripe secrets.
