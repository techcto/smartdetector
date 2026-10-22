#!/usr/bin/env bash
set -euo pipefail
app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
builder_image=smartdetector-vega-builder:0.24.12112
build_volume="${SMARTDETECTOR_VEGA_BUILD_VOLUME:-smartdetector-vega-rn72-generated}"
case "$build_volume" in ''|*[!a-zA-Z0-9_.-]*) echo 'Invalid build volume name' >&2; exit 1;; esac
docker build --platform linux/amd64 -t "$builder_image" "$app_dir"
# Nested volume mountpoints must exist before the parent is mounted read-only.
mkdir -p "$app_dir/build" "$app_dir/.generated" "$app_dir/node_modules"
# Keep thousands of SDK/npm files on Linux storage, not a Windows bind mount.
docker volume create "$build_volume" >/dev/null
docker volume create "$build_volume-npm" >/dev/null
docker volume create "$build_volume-dependencies" >/dev/null
docker run --rm \
  --mount "type=bind,source=$app_dir,target=/workspace,readonly" \
  --mount "type=volume,source=$build_volume,target=/workspace/.generated" \
  --mount "type=volume,source=$build_volume-npm,target=/root/.npm" \
  --mount "type=volume,source=$build_volume-dependencies,target=/workspace/node_modules" \
  --mount "type=bind,source=$app_dir/build,target=/artifacts" \
  -e "SMARTDETECTOR_RELEASE_VERSION=${SMARTDETECTOR_RELEASE_VERSION:-0.1.0}" \
  -e "SMARTDETECTOR_VEGA_BUILD_NUMBER=${SMARTDETECTOR_VEGA_BUILD_NUMBER:-1}" \
  -e "SMARTDETECTOR_VEGA_ORIGIN=${SMARTDETECTOR_VEGA_ORIGIN:-https://smartdetector.com}" \
  "$builder_image" \
  'source /root/vega/env && npm ci && npm test && npm run build:app && test -f .generated/project/build/armv7-release/smartdetectorconsole_armv7.vpkg && cp -a .generated/project/build/. /artifacts/ && cp .generated/project/package-lock.json /artifacts/native-package-lock.json && cp .generated/project/security-audit.json /artifacts/security-audit.json && vega --version > /artifacts/sdk-version.txt && cd /artifacts && find armv7-release -name "*.vpkg" -exec sha256sum {} \; > SHA256SUMS'
