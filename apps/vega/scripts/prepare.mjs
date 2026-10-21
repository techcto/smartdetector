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
const packageId = "com.smartdetector.console";
const rnVersion = "0.72";
const target = process.env.SMARTDETECTOR_VEGA_WORK_DIR
  ? path.resolve(process.env.SMARTDETECTOR_VEGA_WORK_DIR)
  : path.join(root, ".generated", "project");
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
        "helloWorld-rn72",
        "--name",
        "SmartDetectorConsole",
        "--packageId",
        packageId,
        "--outputDir",
        target,
      ],
      path.dirname(target)
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
      "Unexpected SDK template. Review manifest, entry point and React Native version before building."
    );
  cpSync(path.join(root, "src"), path.join(target, "src"), { recursive: true });
  writeFileSync(
    path.join(target, "task.js"),
    "import {HeadlessEntryPointRegistry} from '@amazon-devices/headless-task-manager';\nimport {doTask} from './src/AdmHeadlessTask';\nHeadlessEntryPointRegistry.registerHeadlessEntryPoint('com.smartdetector.console.amazon-device-messaging-receiver::doTask',()=>doTask);\n"
  );
  mkdirSync(path.join(target, "assets", "image"), { recursive: true });
  cpSync(
    path.join(root, "assets", "smartdetector-icon.png"),
    path.join(target, "assets", "image", "smartdetector-icon.png")
  );
  writeFileSync(
    path.join(target, "src/config.ts"),
    `export const SERVICE_ORIGIN=__DEV__?${JSON.stringify(
      origins.development
    )}:${JSON.stringify(origins.production)};\n`
  );
  writeFileSync(
    path.join(target, "index.js"),
    "import {AppRegistry} from 'react-native';\nimport App from './src/App';\nimport {name} from './app.json';\nAppRegistry.registerComponent(name,()=>App);\n"
  );
  app.displayName = "SmartDetector Console";
  writeFileSync(
    path.join(target, "app.json"),
    JSON.stringify(app, null, 2) + "\n"
  );
  writeFileSync(
    path.join(target, "metro.config.js"),
    "const {getDefaultConfig,mergeConfig}=require('@react-native/metro-config');\nconst defaults=getDefaultConfig(__dirname);\nmodule.exports=mergeConfig(defaults,{resolver:{sourceExts:[...defaults.resolver.sourceExts,'mjs']}});\n"
  );
  pkg.version = version;
  pkg.dependencies["qrcode-generator"] = "2.0.4";
  pkg.dependencies["@amazon-devices/kepler-amazon-device-messaging"] = "1.0.24";
  pkg.dependencies["@amazon-devices/headless-task-manager"] = "1.2.8";
  pkg.dependencies["@amazon-devices/keplerscript-turbomodule-api"] = "1.2.5";
  pkg.kepler.useSystemJsBundlesForHeadlessJs = false;
  pkg.overrides = JSON.parse(
    readFileSync(path.join(root, "dependency-overrides.json"), "utf8")
  );
  pkg.scripts[
    "build:release"
  ] = `react-native build-vega --build-type Release --build-version ${version} --build-number ${buildNumber} --target armv7 --max-workers 1`;
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
        return `version = ${JSON.stringify(
          version
        )}\nicon = "@image/smartdetector-icon.png"`;
      }
      if (inPackage && /^title\s*=/.test(line))
        return `title = "${app.displayName}"`;
      return line;
    });
  if (!updated)
    throw Error("SDK manifest lacks package version; review template");
  const keyboard = manifest.includes("com.amazon.inputmethod.service")
    ? ""
    : `${
        manifest.includes("[wants]") ? "" : "\n[wants]"
      }\n[[wants.service]]\nid = "com.amazon.inputmethod.service"\n`;
  const privileges = manifest.includes("com.amazon.notification.privilege.post")
    ? ""
    : '\n[[needs.privilege]]\nid = "com.amazon.notification.privilege.post"\n';
  const adm = !manifest.includes(
    `${packageId}.amazon-device-messaging-receiver`
  )
    ? `\n[[needs.privilege]]\nid = "com.amazon.device-messaging.privilege.access"\n\n[[wants.module]]\nid = "/com.amazon.ace.messaging.service@IDeviceMessaging"\n\n[[wants.service]]\nid = "com.amazon.ace.messaging.service"\n\n[[components.task]]\nid = "${packageId}.amazon-device-messaging-receiver"\nruntime-module = "/com.amazon.kepler.keplerscript.runtime.loader_2@IKeplerScript_2_0"\n\n[[processes.group]]\nid = "notifications"\ncomponent-ids = ["${packageId}.amazon-device-messaging-receiver"]\n`
    : "";
  writeFileSync(manifestPath, lines.join("\n") + keyboard + privileges + adm);
  if (process.argv.includes("--build")) {
    const lock = path.join(root, "native-package-lock.json");
    if (existsSync(lock)) cpSync(lock, path.join(target, "package-lock.json"));
    run("npm", [existsSync(lock) ? "ci" : "install"], target);
    run(
      path.join(target, "node_modules", ".bin", "tsc"),
      ["--noEmit", "--pretty", "false"],
      target
    );
    run(process.execPath, [path.join(root, "scripts", "audit.mjs")], target);
    run("npm", ["run", "build:app"], target);
  }
  console.log(
    `Prepared ${target}. SDK-generated dependencies/runtime retained. Device package must be ARMv7; inspect build output before submission.`
  );
} catch (error) {
  console.error(error.message);
  console.error(
    "Install Amazon Vega SDK 0.24 with the selected official template first. See apps/vega/README.md."
  );
  process.exitCode = 1;
}
