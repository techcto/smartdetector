# SmartDetector demo assets

Uses the existing blue S-shield and navy wordmark from `public/brand`, not the older teal signal-shield identity. No generated replacement logo or third-party artwork is used.

- **Devpost thumbnail:** `devpost-thumbnail.png` — 1200 × 800, 3:2, white background. Upload this in Project overview → Edit thumbnail. The SVG is its editable source.
- **Square icon:** `smartdetector-icon-1024.png` — 1024 × 1024, white background; a companion icon, not the preferred Devpost thumbnail.

Regenerate PNGs with Playwright's browser dependencies installed:

```bash
node apps/vega/preview/render-brand.mjs
```

## Devpost overview copy

Project name: **SmartDetector**

Elevator pitch:

> Your devices. One perspective. A native Vega TV app that brings Ring camera events, saved evidence and Amazon Bedrock summaries to your screen—paired securely and built for your remote.

AutoVision is an optional, separately developed external detection add-on, not part of this hackathon submission. Do not put Alexa integration, camera control or verified background movie overlays in the elevator pitch.
