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
    // Vega has no browser: external pages are shown as addresses. Focus moves to Back and returns to the opener.
    const focusedOn = (label) => page.waitForFunction((l) => document.activeElement?.textContent?.trim() === l, label, { timeout: 5000 });
    await page.getByRole("button", { name: "Add device", exact: true }).click();
    await page.getByText("http://localhost:8082/devices", { exact: true }).waitFor();
    await focusedOn("← Back");
    assert.equal(page.context().pages().length, 1);
    await page.keyboard.press("Enter");
    await focusedOn("Add device");
    await page.getByRole("button", { name: "Add Ring connection" }).click();
    await page.getByText("http://localhost:8082/devices/integrations/ring", { exact: true }).waitFor();
    await focusedOn("← Back");
    await page.keyboard.press("Escape");
    await focusedOn("Add Ring connection");
    await page.getByRole("button", { name: "Console settings" }).click();
    await focusedOn("Back to console");
    for (const [label, url] of [["Privacy policy", "http://localhost:8082/privacy"], ["Delete saved data", "http://localhost:8082/privacy#data-deletion"], ["Request account deletion", "http://localhost:8082/privacy#account-deletion"]]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.getByText(url, { exact: true }).waitFor();
      await focusedOn("← Back");
      await page.keyboard.press(label === "Delete saved data" ? "Escape" : "Enter");
      await focusedOn("Back to console");
    }
    await page.keyboard.press("Escape");
    await focusedOn("Console settings");
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
