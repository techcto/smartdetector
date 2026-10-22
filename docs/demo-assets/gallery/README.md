# Devpost image gallery

Upload these PNGs in order. Each is **1200 × 800 (3:2)** and below Devpost’s 5 MB per-image limit. There are eleven images, within the fifteen-image allowance shown in the submission form.

| Order | Image | What it shows |
| --- | --- | --- |
| 1 | [Website](01-website.png) | Product homepage; camera photo replaced with a similar anonymous AI scene. |
| 2 | [Dashboard](02-dashboard.png) | Actual smartdetector.com interface with AI-replaced camera photos; account identifier remains masked. |
| 3 | [Device catalog](03-devices.png) | SmartDetector’s integration catalog. |
| 4 | [Connect Ring](04-connect-ring.png) | SmartDetector’s Ring authorization instructions. This is not Ring’s own login or proof of a completed connection. |
| 5 | [Approve TV](05-pair-tv-web.png) | Browser side of the pairing flow, with a nonfunctional example code. |
| 6 | [TV QR pairing](06-tv-qr.png) | Shared TV screen captured in the browser. |
| 7 | [TV devices](07-tv-devices.png) | Physical Vega Fire TV interface with similar AI-generated camera scenes. |
| 8 | [TV camera](08-tv-camera.png) | Browser camera-detail fixture with an illustrative AI photo. |
| 9 | [TV event](09-tv-event.png) | Native physical-TV review interface with an illustrative AI photo; device identifier remains masked. |
| 10 | [TV search](10-tv-search.png) | Browser search fixtures with illustrative AI thumbnails. |
| 11 | [TV settings](11-tv-settings.png) | Read-only display settings. |

## What these images establish

Gallery items 2, 7 and 9 use connected-account interfaces captured on October 22, 2026. Items 7 and 9 come from the physical Vega TV running local 0.1.18 build 14; item 2 comes from smartdetector.com. For the public marketing gallery, photographic regions in items 1, 2, 7, 8, 9 and 10 have been replaced with similar AI-generated anonymous scenes. These are illustrations, not untouched screenshots, real household footage, new detections or inference evidence. Every edited card carries that disclosure. UI pixels outside the photographic regions and exterior provenance caption are verified unchanged; see [pixel audit](ai-edit-audit.json). Account/device identifier masks are retained. Unedited originals and raw videos remain outside Git in the private sibling demo-assets directory.

The other images retain their original provenance: website onboarding/catalog captures use an isolated local account, and TV pairing, camera detail, search and settings remain shared React Native Web previews with fixtures. Screens without camera imagery were left unchanged. These previews do not establish native behavior on screens we have not captured. Neither the illustrative photos nor supplied external detections prove fresh SmartDetector Bedrock inference.

AutoVision is an optional external detection add-on, outside the hackathon submission. Recorded sample imagery is demonstration content, not a claim of SmartDetector-native image detection or a live Bedrock response.

## Reproduce

Start the local website and ensure the [existing TV captures](../../images/vega-playwright/README.md) are present. With matching Playwright browser dependencies available:

```bash
GALLERY_URL=http://localhost:8082 node apps/vega/preview/capture-gallery.mjs
```

The original fixture capture script refuses non-loopback targets and deletes only its own temporary local account. It and `render-native-gallery.mjs` produce baseline captures, not the final AI-illustrated gallery. Back up this gallery before running either script. The final image-only compositing pass is:

```bash
PRIVATE_CAPTURE_DIR=/path/to/smartdetector-demo-assets node apps/vega/preview/polish-gallery.mjs
```

It reads the pre-edit 1200×800 cards from `gallery-before-ai/` in that private directory, uses the committed AI scene assets, verifies unchanged UI pixels, and writes the six replacements and audit. Raw captures must never be copied into the repository. Keep provenance captions when reusing assets.

## AI editing brief

Built-in image generation was used, followed by deterministic photo-region compositing. Prompt: sharp, photorealistic anonymous security-camera scenes similar to the originals (parcel delivery, garden gate, visitor leaving, front lawn with pickup and gardener, empty pet room, kitchen, pool). No identifiable faces, addresses, readable plates, device IDs, logos or embedded timestamps. Preserve the actual UI; do not redraw navigation, controls or analysis. Sources: `../ai-camera-scenes.png` and `../ai-pool-scene.png`.
