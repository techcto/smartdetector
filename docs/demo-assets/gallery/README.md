# Devpost image gallery

Upload these PNGs in order. Each is **1200 × 800 (3:2)** and below Devpost’s 5 MB per-image limit. There are eleven images, within the fifteen-image allowance shown in the submission form.

| Order | Image | What it shows |
| --- | --- | --- |
| 1 | [Website](01-website.png) | Product homepage with public recorded demo content. |
| 2 | [Dashboard](02-dashboard.png) | Device activity and recent events, using isolated recorded fixtures. |
| 3 | [Device catalog](03-devices.png) | SmartDetector’s integration catalog. |
| 4 | [Connect Ring](04-connect-ring.png) | SmartDetector’s Ring authorization instructions. This is not Ring’s own login or proof of a completed connection. |
| 5 | [Approve TV](05-pair-tv-web.png) | Browser side of the pairing flow, with a nonfunctional example code. |
| 6 | [TV QR pairing](06-tv-qr.png) | Shared TV screen captured in the browser. |
| 7 | [TV devices](07-tv-devices.png) | Camera and activity rails with test fixtures. |
| 8 | [TV camera](08-tv-camera.png) | Camera detail and history navigation. |
| 9 | [TV event](09-tv-event.png) | Frame-review interface with blank evidence fixtures. |
| 10 | [TV search](10-tv-search.png) | Saved-event search results from test fixtures. |
| 11 | [TV settings](11-tv-settings.png) | Read-only display settings. |

## What these images establish

These are actual browser UI captures, presented on labeled gallery cards. They are not generated mockups. Website screens use an isolated temporary local account; dashboard camera/event responses come from public recorded samples. No Ring account was connected and no fresh inference ran. The temporary account is deleted by the capture script, and fixture devices/events are never written to the database.

TV images are from the shared React Native Web UI captured by Playwright, not native Vega screenshots. Their captions preserve that distinction. Use an actual Vega simulator or physical-TV recording for the required native demonstration. No private household footage, real account identifiers, provider tokens or credentials are included.

AutoVision is an optional external detection add-on, outside the hackathon submission. Recorded sample imagery is demonstration content, not a claim of SmartDetector-native image detection or a live Bedrock response.

## Reproduce

Start the local website and ensure the [existing TV captures](../../images/vega-playwright/README.md) are present. With matching Playwright browser dependencies available:

```bash
GALLERY_URL=http://localhost:8082 node apps/vega/preview/capture-gallery.mjs
```

The script refuses non-loopback targets. It creates and then deletes only its own temporary local account. The capture never opens production customer cameras. The image sources and labels are defined in the script; do not remove the fixture/native-preview distinctions when reusing them.
