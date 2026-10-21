import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  resolve: {
    alias: [
      { find: /^qrcode-generator$/, replacement: path.join(here, "node_modules/qrcode-generator/dist/qrcode.mjs") },
      { find: /^\.\/config$/, replacement: path.join(here, "config.ts") },
      { find: /^\.\/brand$/, replacement: path.join(here, "brand.ts") },
      { find: /^\.\/voice$/, replacement: path.join(here, "voice.ts") },
      { find: /^\.\/focus$/, replacement: path.join(here, "focus.ts") },
      { find: /^react-native$/, replacement: path.join(here, "native-web.ts") },
      { find: /^react$/, replacement: path.join(here, "node_modules/react") },
      { find: /^react\//, replacement: path.join(here, "node_modules/react/") },
    ],
  },
  server: {
    watch: {usePolling:true,interval:500},
    fs: { allow: [path.resolve(here, "..")] }, strictPort: true,
    proxy: Object.fromEntries(
      ["/api/v1/tv/pair", "/api/v1/tv/feed", "/api/v1/events/search"].map(
        (route) => [`^${route}$`, {
          target: process.env.SMARTDETECTOR_PREVIEW_API_TARGET || "http://localhost:8082", changeOrigin: true, secure: true,
          configure(proxy) {
            proxy.on("proxyReq", (request) => request.removeHeader("cookie"));
          },
        }],
      ),
    ),
  },
});
