import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  cpSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { serviceOrigins } from "./service-origins.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const notifications = process.argv.includes("--notifications-rn72");
const packageId = notifications ? "com.smartdetector.alerts" : "com.smartdetector.console";
const rnVersion = notifications ? "0.72" : "0.83";
const target = process.env.SMARTDETECTOR_VEGA_WORK_DIR ? path.resolve(process.env.SMARTDETECTOR_VEGA_WORK_DIR) : path.join(root, ".generated", notifications ? "notifications-rn72" : "project");
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw Error(`${command} failed: ${result.error?.message ?? result.status}`);
}
try {
  const origins = serviceOrigins();
  const version = process.env.SMARTDETECTOR_RELEASE_VERSION || "0.1.0";
  const buildNumber = process.env.SMARTDETECTOR_VEGA_BUILD_NUMBER || "1";
  if (
    !/^[1-9][0-9]*$/.test(buildNumber) ||
    !Number.isSafeInteger(Number(buildNumber))
  )
    throw Error("Invalid native build number");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
    throw Error("Invalid release version");
  run("vega", ["--version"]);
  mkdirSync(path.dirname(target), { recursive: true });
  if (!existsSync(target))
    run(
      "vega",
      [
        "project",
        "generate",
        "--template",
        notifications ? "helloWorld-rn72" : "helloWorld",
        "--name",
        notifications ? "SmartDetectorAlerts" : "SmartDetectorConsole",
        "--packageId",
        packageId,
        "--outputDir",
        target,
      ],
      path.dirname(target),
    );
  const manifestPath = path.join(target, "manifest.toml");
  const manifest = readFileSync(manifestPath, "utf8");
  const app = JSON.parse(readFileSync(path.join(target, "app.json"), "utf8"));
  const pkgPath = path.join(target, "package.json"),
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (
    !manifest.includes(`id = "${packageId}"`) ||
    !manifest.includes("[os.version]") ||
    !manifest.includes("com.amazon.category.main") ||
    !app.name?.startsWith(packageId) ||
    !String(pkg.dependencies?.["react-native"]).includes(rnVersion)
  )
    throw Error(
      "Unexpected SDK template. Review manifest, entry point and React Native version before building.",
    );
  cpSync(path.join(root, "src"), path.join(target, "src"), { recursive: true });
  if (notifications) cpSync(path.join(root, "notifications-rn72", "notifications.ts"), path.join(target, "src", "notifications.ts"));
  mkdirSync(path.join(target, "assets", "image"), { recursive: true });
  cpSync(
    path.join(root, "assets", "smartdetector-icon.png"),
    path.join(target, "assets", "image", "smartdetector-icon.png"),
  );
  writeFileSync(
    path.join(target, "src/config.ts"),
    `export const SERVICE_ORIGIN=__DEV__?${JSON.stringify(origins.development)}:${JSON.stringify(origins.production)};\n`,
  );
  writeFileSync(
    path.join(target, "index.js"),
    "import {AppRegistry} from 'react-native';\nimport App from './src/App';\nimport {name} from './app.json';\nAppRegistry.registerComponent(name,()=>App);\n",
  );
  app.displayName = notifications ? "SmartDetector Alerts" : "SmartDetector Console";
  writeFileSync(
    path.join(target, "app.json"),
    JSON.stringify(app, null, 2) + "\n",
  );
  writeFileSync(
    path.join(target, "metro.config.js"),
    "const {getDefaultConfig,mergeConfig}=require('@react-native/metro-config');\nconst defaults=getDefaultConfig(__dirname);\nmodule.exports=mergeConfig(defaults,{resolver:{sourceExts:[...defaults.resolver.sourceExts,'mjs']}});\n",
  );
  pkg.version = version;
  pkg.dependencies["qrcode-generator"] = "2.0.4";
  if (notifications) {
    pkg.dependencies["@amazon-devices/expo-notifications"] = "2.0.9000000000";
    pkg.dependencies.expo = "~50.0.0";
  }
  pkg.overrides = JSON.parse(
    readFileSync(path.join(root, "dependency-overrides.json"), "utf8"),
  );
  pkg.scripts["build:release"] =
    `react-native build-vega --build-type Release --build-version ${version} --build-number ${buildNumber}`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  // Only change the package version; retain the SDK's runtime and component definitions.
  let inPackage = false,
    updated = false;
  const lines = manifest
    .split("\n")
    .filter((line) => line.trim() !== 'icon = "@image/smartdetector-icon.png"')
    .map((line) => {
      if (/^\[/.test(line)) inPackage = line.trim() === "[package]";
      if (inPackage && /^version\s*=/.test(line)) {
        updated = true;
        return `version = ${JSON.stringify(version)}\nicon = "@image/smartdetector-icon.png"`;
      }
      if (inPackage && /^title\s*=/.test(line))
        return `title = "${app.displayName}"`;
      return line;
    });
  if (!updated)
    throw Error("SDK manifest lacks package version; review template");
  const keyboard = manifest.includes("com.amazon.inputmethod.service")
    ? ""
    : `${manifest.includes("[wants]") ? "" : "\n[wants]"}\n[[wants.service]]\nid = "com.amazon.inputmethod.service"\n`;
  const privileges = notifications ? ["post", "query"].filter(p => !manifest.includes(`com.amazon.notification.privilege.${p}`)).map(p => `\n[[needs.privilege]]\nid = "com.amazon.notification.privilege.${p}"\n`).join("") : "";
  writeFileSync(manifestPath, lines.join("\n") + keyboard + privileges);
  if (process.argv.includes("--build")) {
    const lock = path.join(root, notifications ? "notifications-rn72/package-lock.json" : "native-package-lock.json");
    if (existsSync(lock)) cpSync(lock, path.join(target, "package-lock.json"));
    run("npm", [existsSync(lock) ? "ci" : "install"], target);
    run(
      path.join(target, "node_modules", ".bin", "tsc"),
      ["--noEmit", "--pretty", "false"],
      target,
    );
    run(process.execPath, [path.join(root, "scripts", "audit.mjs")], target);
    run("npm", ["run", "build:app"], target);
  }
  console.log(
    `Prepared ${target}. SDK-generated dependencies/runtime retained. Device package must be ARMv7; inspect build output before submission.`,
  );
} catch (error) {
  console.error(error.message);
  console.error(
    "Install Amazon Vega SDK 0.24 with the selected official template first. See apps/vega/README.md.",
  );
  process.exitCode = 1;
}
