import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
try {
  for (const viewport of [
    { width: 960, height: 540 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport }),
      errors = [];
    let approved = false,
      empty = false,
      oneCameraNoEvents = false;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      const req = route.request(),
        body = req.method() === "POST" ? req.postDataJSON() : null;
      const devices = empty
        ? []
        : Array.from({ length: oneCameraNoEvents ? 1 : 7 }, (_, i) => ({
            id: "camera-" + i,
            name: "Camera " + i,
            status: "healthy",
            liveView: true,
          }));
      const incidents =
        empty || oneCameraNoEvents
          ? []
          : Array.from({ length: 9 }, (_, i) => ({
              id: "event-" + i,
              deviceId: "camera-" + (i % 7),
              at: new Date().toISOString(),
              summary: "Person at the front door — saved event " + i,
              state: "review",
              thumbnail: image,
              frames: Array.from({ length: 12 }, (_, j) => ({
                at_ms: j * 1000,
                preview: image,
                detections: [],
              })),
            }));
      const value = req.url().endsWith("/tv/pair")
        ? body?.deviceCode
          ? approved
            ? { token: "test-only" }
            : { error: "authorization_pending" }
          : {
              userCode: "ABCDE-12345",
              deviceCode: "test-only-private-code",
              expiresAt: Date.now() + 600000,
              interval: 5,
            }
        : req.url().endsWith("/events/search")
        ? { items: incidents, matched: incidents.length, truncated: false }
        : { updatedAt: new Date().toISOString(), devices, incidents };
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    });
    await page.goto(process.env.PREVIEW_URL || "http://127.0.0.1:8090");
    await page
      .getByRole("img", { name: "Scan this QR code to connect your TV" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Open pairing approval", exact: true })
        .count(),
      0
    );
    async function fits(name, vertical = false) {
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1
        ),
        false,
        name + " horizontal overflow"
      );
      if (vertical && viewport.width >= 900) {
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollHeight > innerHeight + 2
          ),
          false,
          name + " document overflow"
        );
        const overflow = await page.evaluate(() =>
          Array.from(document.querySelectorAll("div"))
            .filter(
              (el) =>
                ["auto", "scroll"].includes(getComputedStyle(el).overflowY) &&
                el.clientHeight > 0 &&
                el.scrollHeight > el.clientHeight + 2
            )
            .map((el) => ({
              height: el.clientHeight,
              content: el.scrollHeight,
            }))
        );
        assert.deepEqual(overflow, [], name + " vertical overflow");
      }
      if (process.env.SCREENSHOT_DIR)
        await page.screenshot({
          path:
            process.env.SCREENSHOT_DIR +
            "/" +
            viewport.width +
            "-" +
            name +
            ".png",
        });
    }
    await fits("pairing", true);
    approved = true;
    await page
      .getByRole("button", { name: "Browse device", exact: true })
      .first()
      .waitFor({ timeout: 16000 });
    await fits("home");
    const cameraButtons = page.getByRole("button", {
      name: "Browse device",
      exact: true,
    });
    await cameraButtons.last().focus();
    await page.waitForTimeout(400);
    const last = await cameraButtons.last().boundingBox();
    assert.ok(
      last.x >= 0 && last.x + last.width <= viewport.width + 1,
      "focused camera stays visible"
    );
    await cameraButtons.first().click();
    await page
      .getByRole("button", { name: "Device history", exact: true })
      .waitFor();
    await fits("device", true);
    await page
      .getByRole("button", { name: "Device history", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Review event", exact: true })
      .first()
      .click();
    await page.getByText("Event review", { exact: true }).waitFor();
    await fits("event", true);
    await page
      .getByRole("button", { name: "Search events", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Search saved events" }).waitFor();
    await fits("search", true);
    await page
      .getByRole("textbox", { name: "Search saved events" })
      .fill("person");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByText("Search results", { exact: true }).waitFor();
    await fits("results", true);
    await page
      .getByRole("button", { name: "Console settings", exact: true })
      .click();
    await fits("settings", true);
    await page
      .getByRole("button", { name: "Disconnect this console…" })
      .click();
    await fits("disconnect", true);
    await page
      .getByRole("button", { name: "Keep connected", exact: true })
      .click();
    await page.keyboard.press("Escape");
    oneCameraNoEvents = true;
    await page.getByRole("button", { name: "Devices", exact: true }).click();
    await page
      .getByText("Waiting for camera events", { exact: true })
      .waitFor({ timeout: 12000 });
    await fits("one-camera-no-events", true);
    const waiting = await page
      .getByText("Waiting for camera events", { exact: true })
      .boundingBox();
    assert.ok(
      waiting.y >= 0 && waiting.y + waiting.height <= viewport.height,
      "empty activity stays on screen"
    );
    assert.deepEqual(errors, []);
    console.log(
      viewport.width +
        "x" +
        viewport.height +
        ": QR, auto approval, rails, device, event, search, settings, disconnect passed"
    );
    await page.close();
  }
} finally {
  await browser.close();
}
