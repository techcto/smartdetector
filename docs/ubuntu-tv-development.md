# Ubuntu: local SmartDetector and Vega TV development

This starts the real local backend, the React Native Web preview, and the native
Vega app against the same localhost database. No private Ring camera or AWS
credentials are required for startup. Real AutoVision analysis, Bedrock, delivery,
and Ring access require their separately configured credentials.

## 1. Prerequisites

Use native Ubuntu supported by [Amazon's SDK instructions](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk),
an x86_64 CPU for the commands below, Docker Engine with Compose v2, Git, and
Node.js 22.22 or a compatible SDK-supported version. Root-project host checks
require Node.js 26 per `package.json`; Docker supplies that version for the backend.
Use separate version-manager shells if needed. Allow enough disk space for the
SDK, simulator, Docker images and npm dependencies.

```sh
sudo apt-get update
sudo apt-get install -y git curl jq lz4 unzip libpulse0 libjpeg62
```

Enable CPU virtualization in BIOS/firmware and ensure `/dev/kvm` exists. Add your
Ubuntu user to `kvm` if necessary:

```sh
sudo usermod -aG kvm "$USER"
# Sign out/in or open a session that picks up the new group, then verify:
id
test -r /dev/kvm && test -w /dev/kvm && echo 'KVM ready'
docker version
docker compose version
```

Do not change `/dev/kvm` to world-writable or run the app as root. Install Docker
using its official Ubuntu guide; Docker-group membership grants powerful host access.
Follow Amazon's additional OS-specific SDK dependencies. Optional React Native
DevTools may need Chromium runtime libraries; its absence does not stop Metro.

Install the same SDK version as this project, including the virtual device:

```sh
curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh -o /tmp/smartdetector-vega-installer.sh
# Review the downloaded installer before executing it.
NONINTERACTIVE=true SKIP_SDK_INSTALL=true bash /tmp/smartdetector-vega-installer.sh
source "$HOME/vega/env"
vega sdk install 0.24.12112 --non-interactive
vega --version
```

SDK terms apply. Never commit SDK installers, proprietary SDK files, credentials,
tokens, or your local `.env`. WSL2/WSLg worked experimentally on our development
machine, including KVM and host GPU mode, but is not an Amazon-supported guarantee.
Keep native Ubuntu and physical Fire TV testing as the supported validation path.

## 2. Start the whole local backend

```sh
git clone --recurse-submodules https://github.com/techcto/smartdetector.git
cd smartdetector
# First setup only; never overwrite an existing .env.
test -f .env || cp .env.example .env
bash app.sh up
curl --fail http://localhost:8082/api/health
docker compose ps
```

The console is **http://localhost:8082**, with example login
`root` / `smartdetector-local-change-me`. Change the ignored `.env` root/session
secrets before using it beyond a private development machine. The wrapper creates
the shared Docker network and starts web, API, worker, DynamoDB Local, queue and
object storage. Ports are loopback-bound. AWS billing/notifications are not enabled
by this local startup. Do not use `down -v` unless deliberately discarding local data.

For cameras, follow [Ring Playground testing](ring-developer-testing.md): create
an Amazon Developer account, open the Ring Playground, generate its temporary
token, then use Devices → Ring → Connect provider → Developer testing. Tokens
expire after at most 30 minutes; camera IDs/history remain. Discovery/live view
does not by itself generate analyzed SmartDetector events. Never paste a token
into Git, chat, a screenshot, or a shell command.

## 3. Open the shared React Native Web UI

From the repository root:

```sh
docker compose -f apps/vega/compose.preview.yml up -d --build
```

Open **http://localhost:8090**. It proxies only the allowed display APIs to the
local web container. Source mounts and polling enable live UI updates on native
Ubuntu and Windows mounts. It never falls back to production if localhost is down.
Dependency changes require rebuilding this preview image.

## 4. Build the native Debug app

Use Linux filesystem storage for generated dependencies, especially under WSL.
In terminal A, from the repository root:

```sh
source "$HOME/vega/env"
export SMARTDETECTOR_VEGA_WORK_DIR="$HOME/.cache/smartdetector-vega/project"
npm --prefix apps/vega ci
npm --prefix apps/vega run prepare:app
cp apps/vega/native-package-lock.json "$SMARTDETECTOR_VEGA_WORK_DIR/package-lock.json"
npm --prefix "$SMARTDETECTOR_VEGA_WORK_DIR" ci
cd "$SMARTDETECTOR_VEGA_WORK_DIR"
npx react-native build-vega --build-type Debug --target x86_64 --max-workers 1 --build-number 1
npm start -- --port 8081 --max-workers 1
```

Keep Metro running. Debug uses **http://localhost:8082** automatically. Release
uses **https://smartdetector.com** automatically; production does not inherit a
local HTTP override. See mode/configuration below.

## 5. Boot Vega and connect to localhost

In terminal B:

```sh
source "$HOME/vega/env"
export SMARTDETECTOR_VEGA_WORK_DIR="$HOME/.cache/smartdetector-vega/project"
vega virtual-device start --timeout 120 --gl-accel
vega device start-port-forwarding -d VirtualDevice -p 8081 --forward false
vega device start-port-forwarding -d VirtualDevice -p 8082 --forward false
vega run-app "$SMARTDETECTOR_VEGA_WORK_DIR/build/x86_64-debug/smartdetectorconsole_x86_64.vpkg" com.smartdetector.console.main -d VirtualDevice
```

Keep this terminal and the simulator open. If graphics are unstable, stop the
virtual device and retry with `--no-gl-accel`. Do not terminate unrelated processes
to free ports. If AutoVision occupies 8081, use Amazon's documented custom Metro
port plus reverse mapping instead.

In terminal C, from the repository root:

```sh
export SMARTDETECTOR_VEGA_WORK_DIR="$HOME/.cache/smartdetector-vega/project"
npm --prefix apps/vega run dev:sync
```

Shared `apps/vega/src` edits are copied into the native workspace and delivered
through Metro Fast Refresh. The generated service-origin configuration is preserved.
Adding dependencies, changing the manifest/native code, or changing backend origins
requires preparation/rebuilding as appropriate. Release packages do not hot reload;
this is development tooling, not production OTA updates.

## 6. Approve the TV

The TV automatically displays a QR code and public pairing code. On this same
computer, open **http://localhost:8082/tv/connect**, sign in, confirm the matching
code and location, and approve. The TV then opens its real scoped feed automatically.
The web preview is paired separately. Login alone never approves a display.

A phone cannot reach your computer via a `localhost` QR URL. For phone scanning
or a physical TV, use a reachable HTTPS test installation or explicitly configured
HTTPS tunnel; never expose the local stack by default. Set
`SMARTDETECTOR_VEGA_DEV_ORIGIN=https://your-test-origin` before preparing the Debug
project. Re-prepare and reload after changing it.

## Modes and optional origins

| Client/build | Default backend |
| --- | --- |
| Browser `npm run dev` / Compose preview | `http://localhost:8082` |
| Browser production bundle | `https://smartdetector.com` |
| Native Debug / Metro Fast Refresh | `http://localhost:8082` |
| Native Release | `https://smartdetector.com` |

Native configuration uses React Native's `__DEV__`; browser configuration uses
Vite's build-time development flag. `SMARTDETECTOR_VEGA_DEV_ORIGIN` changes only
native development. An HTTPS `SMARTDETECTOR_VEGA_ORIGIN` changes the native release
origin for private deployments. Legacy loopback HTTP overrides affect development
only, never Release. Remote HTTP URLs and embedded credentials are rejected.
These are public service URLs, not secrets; never embed credentials in app builds.

## Tests and expected results

```sh
npm --prefix apps/vega test
node devops/testing/tv-pairing-smoke.mjs
npm --prefix apps/vega/preview ci
cd apps/vega/preview
npx playwright install --with-deps chromium
PREVIEW_URL=http://localhost:8090 npm run test:browser
```

The HTTP smoke test creates a local test display, checks approval/scoping/CSRF,
then revokes its connection. Browser tests use isolated mocked contract responses
and cover four TV/mobile sizes, QR onboarding, row navigation and screen fit. They
never read production cameras. Node.js 26 is required for root web tests
(`npm ci && npm run test:web`). Use Vega/Appium and physical hardware for native
remote focus, graphics, voice and final Fire TV verification; Playwright is not a
native Vega driver. An empty feed without camera events is expected, not fabricated.

For shutdown, stop Metro/source sync with Ctrl+C, run `vega virtual-device stop`,
stop the preview with its Compose file, and run `bash app.sh down`. Local database
volumes are retained. See [the native app README](../apps/vega/README.md) for
packaging, known SDK dependency audit findings, and platform feature limitations.
