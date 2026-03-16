#!/usr/bin/env bash
# Install the most recently modified APK from dist/ onto a connected Android device.

set -euo pipefail

DIST_DIR="$(cd "$(dirname "$0")/../../dist" && pwd)"
APK=$(ls -t "$DIST_DIR"/*.apk 2>/dev/null | head -1)

if [ -z "$APK" ]; then
  echo "No APK found in $DIST_DIR"
  exit 1
fi

echo "Installing $(basename "$APK")"
adb install -r "$APK"
