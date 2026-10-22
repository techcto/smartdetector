import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
test("QR code survives sign-in redirect without accepting arbitrary return URLs", async () => {
  const response = await proxy(
    new NextRequest("https://smartdetector.com/tv/connect?code=ABCDE-12345")
  );
  assert.equal(
    new URL(response.headers.get("location")!).searchParams.get("next"),
    "/tv/connect?code=ABCDE-12345"
  );
  const invalid = await proxy(
    new NextRequest(
      "https://smartdetector.com/tv/connect?code=https://evil.example"
    )
  );
  assert.equal(
    new URL(invalid.headers.get("location")!).searchParams.get("next"),
    "/tv/connect"
  );
});
test("TV device links survive sign-in redirect; other paths do not", async () => {
  const next = async (path: string) =>
    new URL(
      (await proxy(new NextRequest("https://smartdetector.com" + path))).headers.get("location")!
    ).searchParams.get("next");
  for (const path of [
    "/devices",
    "/devices/firetv-4f3916a0-bffa-4789-959d-e3c71fbaa199",
    "/devices/integrations/ring",
    "/devices/front_door/live",
  ])
    assert.equal(await next(path), path);
  for (const path of [
    "/devices/a/b/c/d",
    "/devices/a%2F..%2Fx",
    "/devices.evil",
    "/devicesx",
  ])
    assert.equal(await next(path), null);
});
