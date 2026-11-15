export const DEFAULT_PRODUCTION_ORIGIN =
  'https://ais-pre-qo3kxiduq6rs3dhqtxynxu-828642031036.asia-northeast1.run.app';

export function resolveAppOrigin(origin?: string): string {
  const candidate = origin || (typeof window !== 'undefined' ? window.location.origin : DEFAULT_PRODUCTION_ORIGIN);
  return candidate.replace(/\/+$/, '');
}

export function buildTwaManifestObject(origin?: string) {
  const baseUrl = resolveAppOrigin(origin);
  let host = 'ais-pre-qo3kxiduq6rs3dhqtxynxu-828642031036.asia-northeast1.run.app';
  try {
    host = new URL(baseUrl).host;
  } catch {
    // keep default host
  }

  return {
    packageId: 'com.allinoneskill.mumbai',
    host,
    name: 'All in One Skill',
    launcherName: 'AllInOne',
    display: 'standalone',
    themeColor: '#0F172A',
    themeColorDark: '#0F172A',
    navigationColor: '#0F172A',
    navigationColorDark: '#0F172A',
    navigationDividerColor: '#E2E8F0',
    navigationDividerColorDark: '#1E293B',
    backgroundColor: '#F8FAFC',
    enableNotifications: true,
    startUrl: '/',
    iconUrl: `${baseUrl}/pwa-512x512.png`,
    maskableIconUrl: `${baseUrl}/pwa-maskable-512x512.png`,
    monochromeIconUrl: `${baseUrl}/pwa-192x192.png`,
    splashScreenFadeOutDuration: 300,
    signingKey: {
      path: './android.keystore',
      alias: 'allinoneskill',
    },
    appVersionName: '1.0.0',
    appVersionCode: 1,
    shortcuts: [],
    generatorApp: 'bubblewrap-cli',
    webManifestUrl: `${baseUrl}/manifest.webmanifest`,
    fallbackType: 'customtabs',
    features: {
      locationDelegation: {
        enabled: true,
      },
    },
    alphaDependencies: {
      enabled: false,
    },
    enableSiteSettingsShortcut: true,
    isChromeOSOnly: false,
    isMetaQuest: false,
    fullScopeUrl: `${baseUrl}/`,
    minSdkVersion: 21,
    orientation: 'portrait',
    fingerprints: [],
    additionalTrustedOrigins: [],
    retainedBundles: [],
    appVersion: '1.0.0',
  };
}

export function buildAndroidBuildScript(origin?: string): string {
  const baseUrl = resolveAppOrigin(origin);
  return `#!/usr/bin/env bash
set -euo pipefail

# All in One Skill — Android APK & Google Play AAB Builder (Bubblewrap TWA)
# Requires: Node.js 18+, Java JDK 17+, and Android SDK Command-Line Tools.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT_DIR/output"
BUILD_DIR="$ROOT_DIR/.bubblewrap-project"
MANIFEST_URL="${baseUrl}/manifest.webmanifest"

echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required."; exit 1; }
command -v java >/dev/null 2>&1 || { echo "Error: Java JDK 17+ is required (set JAVA_HOME)."; exit 1; }

if [ -z "\${ANDROID_HOME:-}" ] && [ -z "\${ANDROID_SDK_ROOT:-}" ]; then
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

[ -f app-release-signed.apk ] && cp app-release-signed.apk "$OUT_DIR/all-in-one-skill-release.apk"
[ -f app-release-bundle.aab ] && cp app-release-bundle.aab "$OUT_DIR/all-in-one-skill-playstore.aab"

echo "Done! Check $OUT_DIR for generated .apk and .aab files."
`;
}

export function triggerTextDownload(filename: string, content: string, mimeType = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
