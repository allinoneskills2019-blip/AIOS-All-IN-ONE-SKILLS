# Android APK & Google Play Console (.aab) Build Setup

This folder contains the **Trusted Web Activity (TWA)** build and signing configuration for **All in One Skill** (`com.allinoneskill.mumbai`).

> **Why no `.aab` or `.apk` binary is compiled inside this web container:**
> Compiling an Android App Bundle (`.aab`) for Google Play Console requires **Java JDK 17+**, the **Android SDK**, and **Gradle**, which are not present in a Node-only container. Running `npm run export-android` configures all Vite PWA assets, `dist/.well-known/assetlinks.json`, `android/twa-manifest.json`, and `android/signing-config.gradle`, and automatically triggers `@bubblewrap/cli build` to output `android/output/all-in-one-skill-playstore.aab` when JDK 17 + Android SDK are installed.

---

## Option A — `export-android` Command via Vite (Local / Workstation)

1. Ensure **Java JDK 17+** (`JAVA_HOME`) and **Android SDK** (`ANDROID_HOME`) are installed.
2. Copy `android/signing.properties.example` to `android/signing.properties` (or set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, and `ANDROID_SHA256_FINGERPRINT` in `.env`).
3. Run:

```bash
npm run export-android
```

Generated Google Play bundle output:
- `android/output/all-in-one-skill-playstore.aab`

---

## Option B — Automatic Cloud Build (GitHub Actions)

1. Push this repository to GitHub (`.github/workflows/build-android-apk.yml` is already configured).
2. Set GitHub Secrets `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` for your Play Console upload key.
3. Open **Actions → Build Android APK & AAB → Run workflow** to download the compiled `.aab` and `.apk` artifacts.
