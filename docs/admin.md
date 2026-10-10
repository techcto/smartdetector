# Root administration

Open **Account → Admin**, immediately after Users. `/admin` verifies the signed session role on the server and redirects non-root users to Settings. It is not a main-navigation item.

## AutoVision

Enter the HTTPS service origin and a dedicated service API key, then save. A blank key preserves the existing credential. Saved keys are encrypted with the installation provider/session secret and stored in the existing DynamoDB application table under `SYSTEM#SERVICES / AUTOVISION`. Only root can read configuration status or change these settings; responses never contain the saved key. Web and worker analysis reads this installation-wide configuration. Environment values remain the fallback until an administrator saves a setting.

Keep the encryption secret stable across web/worker tasks and protect the application table and its backups. In memory-only development, saved settings are process-local and not suitable for a separate worker or production. Test image detection is synthetic activity and may consume API quota.

## Ring

The Admin page retains developer credential fields and generated staging URLs. These are currently scoped to the active location, not a global multi-account developer-app model. Customers use Devices → Ring for linking instructions and camera sync, without entering developer credentials. Successful linking automatically imports shared cameras; repeat sync updates the same records. Generic camera classification is used when Ring does not provide an explicit supported family. Non-camera devices are excluded. No lights, sirens, chimes, or alarm-control support is implied.

## Other integrations

Fire TV pairs with a short-lived code; no customer application ID is needed. Native packaging and background push notifications still need device validation. Bedrock uses deployment IAM/model configuration. Alexa+ remains planned, not a working provider. Each has an explicit setup/status explanation in Admin.
