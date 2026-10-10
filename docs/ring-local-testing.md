# Test your Ring account locally

SmartDetector uses **Ring-initiated, one-way account linking**. Start account linking from your Ring developer app's staging/testing workflow; the invitation-only partner-initiated OAuth flow is not used.

## Start SmartDetector and an HTTPS tunnel

Run the normal local Docker Compose stack. The default web port is 8082. In a separate terminal, with Cloudflare Tunnel installed:

```sh
cloudflared tunnel --url http://localhost:8082
```

Alternatively, with an ngrok account and CLI configured:

```sh
ngrok http 8082
```

For the prepared local preview, you can also run the tunnel with Docker, without installing a CLI:

```sh
docker run --rm --network application-platforms-local cloudflare/cloudflared:latest tunnel --url http://smartdetector-demo-local:3000
```

The tunnel exposes your local application to the internet. Before starting it, replace the development default `SMARTDETECTOR_ROOT_PASSWORD` with a strong launch password in your ignored local environment and recreate the application containers using your normal Compose workflow. Keep the tunnel temporary and stop it after testing. No AWS infrastructure changes are needed. A temporary tunnel URL can change after restart; update all four staging URLs whenever it changes.

## Configure the connection

1. Open SmartDetector through the tunnel's **HTTPS URL**, not localhost, and sign in. Use this same hostname throughout account linking so session cookies stay on the same origin.
2. Choose the intended location, then **Devices → Ring → Connect provider**.
3. Enter the staging Client ID, Client Secret, and HMAC signing key issued for your Ring developer application. Save app settings. Do not paste credentials into chat or Git.
4. The connection drawer generates four exact URLs. Copy them into the corresponding **Staging** account-linking fields in Ring's Developer Console. URLs are scoped to this location and saved connection; do not replace their identifiers or query parameters.
5. Start the app installation/account-linking test from Ring's developer/testing workflow. Share an eligible camera and authorize the requested permissions.
6. Ring sends a short-lived authorization code to the token-exchange endpoint. SmartDetector exchanges it server-side and stores encrypted, unclaimed tokens for ten minutes.
7. Ring redirects your browser to the Account Link URL with `nonce` and `time`. Sign in to SmartDetector if needed, select the matching location, and explicitly choose **Confirm Ring connection**. SmartDetector validates the HMAC nonce, confirms the account with Ring, and finalizes the integration.
8. Return to Ring's provider page, choose a device type, select the linked connection, and **Discover authorized cameras**. Select a camera and **Connect device**.

Device types are curated families, not imported claims of compatibility with every hardware generation. The selected type is supplied by the operator; actual device authorization is verified by Ring discovery. Snapshot access depends on Ring's permissions and service availability. Light/siren control and live-video playback are not implemented.

## Verify the event pipeline

The device initially shows **Awaiting first event**, not a fabricated healthy status. Trigger a motion or doorbell event. Ring must deliver a correctly signed webhook for the linked account. The web service enqueues the event; the worker retrieves sampled snapshots and calls the installation's AutoVision service. Review the event and thumbnail in the console.

The worker, queue, and `SMARTDETECTOR_AUTOVISION_URL` / `SMARTDETECTOR_AUTOVISION_API_KEY` must be configured. No API key is required for an operator's browser session. A prerecorded public demo is not evidence that a real Ring account is connected.

To use the hosted AutoVision service during local development, set `SMARTDETECTOR_AUTOVISION_URL=https://autovision.dev` and a dedicated service API key in your ignored `.env`, then recreate both web and worker containers. Authenticated analyses use the key's AutoVision workspace quota and retain results plus a small thumbnail according to AutoVision's retention policy. Enabling classification also sends sampled frames to Bedrock. Do not commit the key or use private camera footage without permission.

## Troubleshooting

- **HTTP URLs shown:** reopen SmartDetector using the tunnel HTTPS address, then reopen Manage connection.
- **Link cannot be verified:** confirm staging credentials, selected location, and connection; restart linking from Ring within the ten-minute nonce window.
- **No devices discovered:** confirm your camera is shared with this app and eligible for the permissions requested by Ring. Do not substitute a regular Ring username/password or unrelated Amazon access token.
- **Events queued but no analysis:** check worker logs, AutoVision reachability, service key, and media permissions.
- **Temporary tunnel stopped:** Ring callbacks cannot reach localhost until a tunnel is running and its current URLs are registered.

## Developer checks

```sh
npm run test:web
npm run build
```

The Ring linking tests use synthetic accounts and mocked Ring responses. They cover nonce freshness/tampering, encrypted token handling, location isolation, replay rejection, token refresh, authorized device selection, and preservation of device metadata during telemetry ingestion. Real Ring credentials and a camera are still required for the final end-to-end test.

Reference: [Ring Partner API documentation](https://developer.amazon.com/docs/ring/api-documentation.html).
