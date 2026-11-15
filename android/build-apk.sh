#!/usr/bin/env bash
set -euo pipefail

# All in One Skill — Android APK & Google Play AAB Builder (Bubblewrap TWA)
# Requires: Node.js 18+, Java JDK 17+, and Android SDK Command-Line Tools.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT_DIR/output"
BUILD_DIR="$ROOT_DIR/.bubblewrap-project"
MANIFEST_URL="https://ais-pre-qo3kxiduq6rs3dhqtxynxu-828642031036.asia-northeast1.run.app/manifest.webmanifest"

echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required."; exit 1; }
command -v java >/dev/null 2>&1 || { echo "Error: Java JDK 17+ is required (set JAVA_HOME)."; exit 1; }

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  echo "Error: ANDROID_HOME or ANDROID_SDK_ROOT must point to your Android SDK."
  exit 1
fi

mkdir -p "$BUILD_DIR" "$OUT_DIR"
cp "$ROOT_DIR/twa-manifest.json" "$BUILD_DIR/twa-manifest.json"
cd "$BUILD_DIR"

echo "Updating TWA Android project from $MANIFEST_URL..."
npx --yes @bubblewrap/cli update --manifest="$MANIFEST_URL" || true

echo "Building signed Android APK & Play Console AAB bundle..."
npx --yes @bubblewrap/cli build --skipPwaValidation

if [ -f app-release-signed.apk ]; then
  cp app-release-signed.apk "$OUT_DIR/all-in-one-skill-release.apk"
fi
if [ -f app-release-bundle.aab ]; then
  cp app-release-bundle.aab "$OUT_DIR/all-in-one-skill-playstore.aab"
fi

echo "Done! Check $OUT_DIR for generated .apk and .aab files."
