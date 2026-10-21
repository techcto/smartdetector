// Browser preview cannot register for native Vega device messaging.
export const backgroundAlertsAvailable = false;
export async function configureBackgroundAlerts(
  _token: string,
  _enabled: boolean
): Promise<void> {
  throw Error("Background alerts require the native notifications build");
}
