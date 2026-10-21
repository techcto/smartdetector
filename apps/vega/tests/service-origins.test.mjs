import test from "node:test";
import assert from "node:assert/strict";
import { serviceOrigins } from "../scripts/service-origins.mjs";
test("Debug defaults to localhost; Release defaults to the production service", () => {
  assert.deepEqual(serviceOrigins({}), {
    development: "http://localhost:8082",
    production: "https://smartdetector.com",
  });
  assert.equal(
    serviceOrigins({ SMARTDETECTOR_VEGA_ORIGIN: "http://localhost:8082" })
      .production,
    "https://smartdetector.com"
  );
  assert.deepEqual(
    serviceOrigins({ SMARTDETECTOR_VEGA_ORIGIN: "https://private.example" }),
    {
      development: "http://localhost:8082",
      production: "https://private.example",
    }
  );
  assert.equal(
    serviceOrigins({ SMARTDETECTOR_VEGA_DEV_ORIGIN: "https://test.example" })
      .development,
    "https://test.example"
  );
  for (const value of [
    "http://public.example",
    "https://user:password@example.com",
  ])
    assert.throws(() => serviceOrigins({ SMARTDETECTOR_VEGA_ORIGIN: value }));
});
