# Isolated RN 0.72 notification build

The working RN 0.83 console remains the default. Amazon documents notifications as unavailable in its RN 0.83 early-access runtime. This explicit build uses the official SDK 0.24 helloWorld-rn72 template, the same screens and API client, and the separate package ID com.smartdetector.alerts.

Prepare from the repository root:

```sh
node apps/vega/scripts/prepare.mjs --notifications-rn72
cd apps/vega/.generated/notifications-rn72
npm install
npx tsc --noEmit
npx react-native build-vega --build-type Release --target armv7 --max-workers 1
```

Release uses production HTTPS; Debug uses localhost as documented in the parent README. Do not point SMARTDETECTOR_VEGA_WORK_DIR at an existing RN 0.83 workspace. Generated projects are disposable.

The notification adapter currently posts normal-importance local system notifications for fresh authorized foreground events. It does not provide background delivery, guarantee an overlay over movies, or implement notification-click navigation. It does not request restricted alarm/system privileges. Notifications are not supported by the virtual device. Do not claim production push readiness.

## ADM prerequisite

In Amazon Developer Console, open the app, then App Services → Device Messaging. Attach or create a dedicated security profile and enable messaging. Under its Web Settings, obtain the client ID and client secret. The secret belongs only in the server secret configuration, never Git, native bundles, browser configuration or screenshots. See [Obtain credentials](https://developer.amazon.com/docs/adm/obtain-credentials.html).

The app-specific ADM registration ID is obtained on the physical device, not invented from a serial number. The receiver package must match the enabled app identity; do not assume the separate experimental package automatically inherits another app registration. Vega uses its native ADM service and manifest privileges, not Android APK certificate instructions.

Next gates: register the paired display with ADM; authorize registration server-side by location and revocation; deliver incident identifiers through the existing notification worker; fetch private event content with scoped authorization; verify receiver execution while another app plays; verify OS presentation, user opt-out and return navigation. Provision server secrets and infrastructure only through reviewed CloudFormation changes. No credentials or background-delivery deployment has been added yet.

Sources: [Vega release notes](https://developer.amazon.com/docs/vega/0.24/vega-release-notes), [notification API](https://developer.amazon.com/docs/vega-api/0.24/expo-notifications), [Vega ADM](https://developer.amazon.com/docs/vega-api/0.24/README.amazon-devices_kepler-amazon-device-messaging).
