import { serviceOrigin } from "../src/client.mjs";
export function serviceOrigins(env = process.env) {
  const override = env.SMARTDETECTOR_VEGA_ORIGIN?.trim();
  const production = serviceOrigin(
    override?.startsWith("https:") ? override : "https://smartdetector.com"
  );
  // Preserve existing local build commands, but never let an HTTP override leak into Release.
  const development = serviceOrigin(
    env.SMARTDETECTOR_VEGA_DEV_ORIGIN?.trim() ||
      (override?.startsWith("http:") ? override : "http://localhost:8082")
  );
  if (override) serviceOrigin(override);
  return { development, production };
}
