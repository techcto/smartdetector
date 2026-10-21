# Vega background TV notifications

The standard TV app uses the official SDK 0.24 helloWorld-rn72 template and the existing com.smartdetector.console identity. RN 0.72 is the supported runtime for this notification integration; there is no alternate app or dual-runtime release.

Prepare from the repository root:

```sh
node apps/vega/scripts/prepare.mjs
cd apps/vega/.generated/project
npm install
npx tsc --noEmit
npx react-native build-vega --build-type Release --target armv7 --max-workers 1
```

Release uses production HTTPS; Debug uses localhost as documented in the parent README. Use a fresh generated workspace for the RN 0.72 template. Generated projects are disposable.

For an update build, set SMARTDETECTOR_RELEASE_VERSION and SMARTDETECTOR_VEGA_BUILD_NUMBER before preparation so manifest and package metadata match. The build number must increase beyond the installed build; an increased semantic version alone does not override a lower build number. Release CI supplies its monotonically increasing workflow run number. Do not force a downgrade or uninstall to work around this check.

The app implements an ADM background task independent of the foreground feed poll. On the TV, pair normally, open Console settings and enable Background TV alerts. Registration is encrypted server-side and expires with the display authorization (at most 24 hours). Turning background alerts off invalidates queued notification capabilities; disconnect also disables the current registration before clearing app memory. Revoke a display on the website to stop its authorization immediately.

The incident worker queues one delivery per authorized display using the existing queue. Delivery retries are independent of email. ADM carries only a two-minute signed incident capability, not footage or a reusable display login. The receiver fetches the event over the configured service origin; the server rechecks expiry, location connection, opt-out, retention and alert suppression before returning private content. Queue delivery is at-least-once; push delivery is best effort, not an exactly-once guarantee.

The popup uses the SDK native NotificationManager toast content contract with a bounded raster thumbnail, an eight-second timeout and a Check cameras launch target. This avoids the Expo adapter, which drops image/launch fields. It requests normal importance, not restricted alarm privileges. The OS controls rendering, imagery and interruption of playback; those behaviors remain unverified until a real ADM message is tested on the physical TV. The action opens the console; it does not silently launch over a movie. Notifications are not supported by the virtual device.

## ADM prerequisite

In Amazon Developer Console, open the app, then App Services → Device Messaging. Attach or create a dedicated security profile and enable messaging. Under its Web Settings, obtain the client ID and client secret. The secret belongs only in the server secret configuration, never Git, native bundles, browser configuration or screenshots. See [Obtain credentials](https://developer.amazon.com/docs/adm/obtain-credentials.html).

In either normal application CloudFormation template, enter AdmClientId and AdmClientSecret as the masked parameters. The application stack creates the secret, grants its execution role access and injects the values into the worker. Both empty disables ADM; supplying only one fails validation. Do not create a separate credentials/bridge stack. Publish the release, then review and execute the normal application change set, checking retained data, IAM and service updates.

The app-specific ADM registration ID comes from the physical device, not a serial number. The enabled Amazon Developer app must be associated with the existing receiver package identity com.smartdetector.console. Vega uses its native ADM service and manifest privileges, not Android APK certificate instructions.

Verification gates: deploy configured server credentials; register the physical app; play owned/licensed video in another app; trigger authorized real Ring motion; observe a popup and open SmartDetector; confirm the image if the OS renderer supports it; disable alerts and verify no further popup. Repeat after revocation and data purge. Compilation and local access-control smoke checks do not establish successful cloud delivery or OS presentation. No production notification deployment or credentials have been configured by this change.

Sources: [Vega release notes](https://developer.amazon.com/docs/vega/0.24/vega-release-notes), [notification API](https://developer.amazon.com/docs/vega-api/0.24/expo-notifications), [Vega ADM](https://developer.amazon.com/docs/vega-api/0.24/README.amazon-devices_kepler-amazon-device-messaging).
