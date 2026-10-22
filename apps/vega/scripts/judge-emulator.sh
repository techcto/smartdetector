#!/usr/bin/env bash
set -euo pipefail
# Judge mode always uses a self-contained Release package, never Metro/localhost.
command -v vega >/dev/null || { echo 'Install the Vega SDK and run: source "$HOME/vega/env"' >&2; exit 1; }
if (( $# > 1 )); then echo "Usage: bash $0 [local-x86_64-release.vpkg]" >&2; exit 1; fi
package_path="${1:-}"
if [[ -z "$package_path" ]]; then
  command -v jq >/dev/null || { echo 'Install jq first.' >&2; exit 1; }
  cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/smartdetector-vega/judge"
  mkdir -p "$cache_dir"
  release_tag="$(curl --fail --silent --show-error --location https://api.github.com/repos/techcto/smartdetector/releases/latest | jq -er '.tag_name')"
  [[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'No stable judge release is available.' >&2; exit 1; }
  release_url="https://github.com/techcto/smartdetector/releases/download/$release_tag"
  package_name=smartdetectorconsole_x86_64.vpkg
  curl --fail --show-error --location --retry 3 "$release_url/$package_name" -o "$cache_dir/$package_name.download"
  curl --fail --silent --show-error --location --retry 3 "$release_url/SHA256SUMS" -o "$cache_dir/SHA256SUMS"
  expected="$(awk '$2 == "smartdetectorconsole_x86_64.vpkg" {print $1}' "$cache_dir/SHA256SUMS")"
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || { echo 'The release lacks the emulator checksum.' >&2; exit 1; }
  actual="$(sha256sum "$cache_dir/$package_name.download")"
  [[ "${actual%% *}" == "$expected" ]] || { echo 'Emulator download checksum mismatch.' >&2; exit 1; }
  mv "$cache_dir/$package_name.download" "$cache_dir/$package_name"
  package_path="$cache_dir/$package_name"
fi
[[ -s "$package_path" && "$package_path" == *_x86_64.vpkg ]] || { echo 'Choose the x86_64 Release .vpkg, not the ARMv7 device package.' >&2; exit 1; }
echo 'Starting SmartDetector judge mode: https://smartdetector.com (no Docker or Metro).'
graphics=--gl-accel
if [[ "${SMARTDETECTOR_VEGA_SOFTWARE_GRAPHICS:-0}" == 1 ]]; then graphics=--no-gl-accel; fi
vega virtual-device start --timeout 120 "$graphics"
vega run-app "$package_path" com.smartdetector.console.main -d VirtualDevice
echo 'Leave the emulator open. Approve its code at https://smartdetector.com/tv/connect.'
