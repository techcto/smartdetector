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
