import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    await page.addInitScript(() => {
      window.SpeechRecognition = class {
        start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: "Show me everyone at my front door today" }]] }); this.onend?.(); }, 10); }
        abort() {}
      };
    });
    page.on("pageerror", (e) => errors.push(e.message));
    // CI never creates a production pairing or reads customer data.
    await page.route("**/api/**", (route) => route.abort());
    await page.goto(process.env.PREVIEW_URL || "http://127.0.0.1:8084");
    await page.getByRole("button", { name: "Get pairing code" }).waitFor();
    await page.getByRole("button", { name: "Open pairing approval" }).waitFor();
    assert.equal(await page.getByText(/demo|synthetic/i).count(), 0);
    await page.getByRole("button", { name: "Get pairing code" }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("button", { name: "Browse device" }).count(), 0);
    // Empty contract responses exist only in the test runner, never in the app.
    await page.unroute("**/api/**");
    await page.route("**/api/**", (route) => {
      const request = route.request();
      const isPair = request.url().endsWith("/tv/pair");
      const body = request.postDataJSON();
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(
        isPair ? (body?.deviceCode ? { token: "test-only" } : { userCode: "TEST-ONLY", deviceCode: "test-only", expiresAt: Date.now() + 60000, interval: 5 })
          : { updatedAt: new Date().toISOString(), devices: [], incidents: [] },
      ) });
    });
    await page.getByRole("button", { name: "Get pairing code" }).click();
    await page.getByRole("button", { name: "Add device", exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Add Ring connection" }).waitFor();
    await page.getByRole("button", { name: "TV keyboard / voice" }).click();
    assert.equal(await page.getByRole("textbox", { name: "Search saved events" }).evaluate((el) => el === document.activeElement), true);
    await page.getByRole("button", { name: "Use browser mic" }).click();
    await page.getByText("Review your words, then select Search.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "Search saved events" }).inputValue(), "Show me everyone at my front door today");
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Disconnect", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Console settings" }).click();
    await page.getByRole("button", { name: "Disconnect this console…" }).click();
    await page.getByRole("button", { name: "Keep connected" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add device", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
    console.log(`${width}px: real-data onboarding, network failure, no fake devices, and overflow checks passed`);
    await page.close();
  }
} finally { await browser.close(); }
