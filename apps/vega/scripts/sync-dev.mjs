// Keep repo source authoritative while Metro watches the generated native project.
import {
  readdirSync,
  statSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const target = process.env.SMARTDETECTOR_VEGA_WORK_DIR
  ? path.resolve(process.env.SMARTDETECTOR_VEGA_WORK_DIR)
  : path.join(root, ".generated/project");
if (
  !existsSync(path.join(target, "manifest.toml")) ||
  !readFileSync(path.join(target, "manifest.toml"), "utf8").includes(
    "com.smartdetector.console"
  )
)
  throw Error("Prepare the SmartDetector native project first");
const stamps = new Map();
function sync(dir = path.join(root, "src")) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sync(source);
      continue;
    }
    const relative = path.relative(path.join(root, "src"), source);
    // The generated configuration records the explicitly chosen backend origin.
    if (relative === "config.ts") continue;
    const stat = statSync(source),
      stamp = stat.mtimeMs + ":" + stat.size;
    if (stamps.get(source) === stamp) continue;
    const dest = path.join(target, "src", relative);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(source, dest);
    stamps.set(source, stamp);
  }
}
sync();
console.log(
  "Native source sync active; Metro Fast Refresh handles supported JS/UI edits. Restart after adding/removing dependencies."
);
const timer = setInterval(() => {
  try {
    sync();
  } catch {
    console.error("Native source sync failed; check project/source paths");
    process.exitCode = 1;
    clearInterval(timer);
  }
}, 500);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    process.exit();
  });
