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
