# Privacy and deletion

The signed-in console actions live under Settings:

- `/settings/account-deletion`: verified email request to help@solodev.com, not automatic account deletion. Support must verify identity, resolve shared workspace ownership, fulfill the request, and confirm completion. Removing a workspace membership alone is not complete account deletion.
- `/settings/data-deletion`: existing administrator-only purge, protected by same-origin checks and an explicit workspace-specific confirmation. Preserves accounts and devices; excludes separate providers, backups, and optional enrolled face references.

Both pages redirect anonymous visitors to login and return to the selected page afterward. The public privacy policy includes instructions and an email fallback for users who cannot log in. After deployment, Amazon Appstore fields can use:

- Privacy policy: `https://smartdetector.com/privacy`
- Account deletion instructions: `https://smartdetector.com/privacy#account-deletion`
- Data-only deletion instructions: `https://smartdetector.com/privacy#data-deletion`

Verify these publicly over HTTPS before submitting. Do not describe the email request as instant deletion. The operator must monitor help@solodev.com. Review the Appstore privacy questionnaire against all enabled providers and SDKs, including optional recognition features; temporary collection still counts as collection.

## Retention

Saved event records, including their sampled images, default to 24 hours, including developer/testing accounts. A verified active paid Stripe subscription permits an administrator to explicitly select 1–365 days in Settings. Trials, canceled/unpaid subscriptions, and merely creating an account do not unlock longer retention. A card retry (`past_due`) keeps the selected period, and the saved choice applies again when a canceled subscription resumes. Existing legacy retention settings do not opt users in.

Each new event gets an immutable maximum expiry (`ttl`). Increasing retention applies to new events only; updates and subscription upgrades cannot extend an existing deadline. Reads across REST, search, console, TV, and people timelines exclude expired evidence. Events saved before per-event deadlines existed follow the workspace period but are not deleted before 2026-12-01 (one-time grace). The worker performs periodic physical cleanup, including legacy records; CloudFormation already enables DynamoDB TTL on `ttl`. TTL deletion is asynchronous, and downtime can delay worker cleanup. Backups and independent providers have separate lifetimes. Deploy the worker as well as web/API.

This is **temporary image storage**, not zero collection or deletion of all user data. Credentials, configuration, billing/operational records and explicitly enrolled biometric references are separate from event retention. Private deployments without an active paid subscription currently retain the same 24-hour default.

Run `npm run test:web` and `npm run typecheck`. Locally, run `bash app.sh up`, log in, inspect Settings, and open the public policy in a logged-out browser. Paid-plan tests use in-memory subscription records; no real purchase is made.
