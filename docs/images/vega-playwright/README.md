# UI capture provenance

Captured October 22, 2026 using the existing `apps/vega/preview/test.browser.mjs` walkthrough, Chromium in the official Playwright 1.60.0 container, and the shared React Native Web UI at 1280 × 720.

These are real browser screenshots and browser video, **not native Vega captures**. API requests are intercepted by the existing test fixture. Camera/event records and timestamps are fixtures; image previews are a blank one-pixel fixture. No production accounts, tokens, private camera imagery or live analysis were used. This media demonstrates UI/navigation only; it cannot establish native remote behavior, Ring webhook delivery, inference accuracy or background notifications.

The WebM records pairing, camera rails, device history, event review, search, settings and disconnect. The brief automation pauses are not service latency measurements. The pairing code is a nonfunctional test fixture. GitHub may download WebM instead of displaying an inline player; open it in a browser/video player.

To reproduce, start the current browser preview following the [Vega README](../../../apps/vega/README.md), then run from the repository root with Playwright's browser dependencies installed:

```bash
PREVIEW_URL=http://localhost:8090 \
CAPTURE_WIDTH=1280 \
SCREENSHOT_DIR="$PWD/docs/images/vega-playwright" \
VIDEO_DIR="$PWD/docs/images/vega-playwright" \
node apps/vega/preview/test.browser.mjs
```

Omit `CAPTURE_WIDTH` to run all existing desktop/phone viewports. Omit the capture variables to run the original checks without exporting media. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects a locally installed Chromium binary; normally use Playwright's matching installed browser.

Generated output is documentation media, not production customer data. Re-capture after UI changes. Keep the final native-device/simulator hackathon demo separate from this browser walkthrough.
