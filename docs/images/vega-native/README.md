# Reviewed native and live-web captures

Captured October 22, 2026. `native-home.png` and `native-event.png` are actual physical Vega Fire TV captures of SmartDetector Console 0.1.18 build 14. `live-web-dashboard.png` is an authenticated smartdetector.com browser capture.

Device identifiers and selected indoor imagery are covered by explicit, opaque privacy masks. Other UI/scene pixels are preserved; no AI image generation or invented detections were used. The frame-review detections come from the configured external add-on, not SmartDetector's text-only Bedrock summary integration.

Raw sources, recordings and session input remain outside Git. The raw session cookie was supplied through non-echoing input and was not written into a file. `render-native-gallery.mjs` reads private sources through `PRIVATE_CAPTURE_DIR` and exports these redacted screenshots and three 1200×800 gallery cards. Review masks again whenever source images change; their coordinates are specific to these selected frames.
