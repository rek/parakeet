# Spec: Expo Config Plugin for Health Connect

**Status**: Planned
**Domain**: Infra / Native config
**Phase**: 1 (must land before any code that imports `react-native-health-connect`)
**Owner**: any executor agent

## What This Covers

Adding `react-native-health-connect` as an Android-only native dependency, configuring its Expo config plugin, declaring required Android permissions in the merged manifest, bumping `minSdkVersion` to satisfy Health Connect requirements, and verifying the EAS Android build produces a working binary.

This is its own spec because it's the highest-risk Phase 1 item: it touches native build config, requires a fresh dev-client build, and breaks if any step is missed.

## Prerequisites

- None. Run before installing module code that imports `react-native-health-connect`.
- Reference: existing `apps/parakeet/app.config.ts` is minimal (no plugins yet — adding the first plugin block).
- Reference: existing memory `feedback_android_only.md` — Parakeet is Android-only; no iOS Health Kit work.
- Reference: existing memory `feedback_nx_scripts_only.md` — use approved Nx scripts; never run raw `gradle`/`expo prebuild` commands.

## Tasks

### 1. Install dependency

From `apps/parakeet/`:

```
npm i react-native-health-connect
```

Expected: package added to `apps/parakeet/package.json` `"dependencies"`. Pin to a known-good range; latest at writing is the `3.x` line (verify `peerDependencies` against `expo` SDK 55 / RN 0.83 in `package.json` of `apps/parakeet` before pinning a major).

### 2. Register the Expo config plugin

**File:** `apps/parakeet/app.config.ts`

Add a `plugins` array. The library ships its own Expo config plugin that injects the manifest entries.

```typescript
import { execSync } from 'child_process';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import pkg from './package.json';

const isDev = process.env.APP_ENV === 'development';

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDev ? 'Parakeet (Dev)' : 'Parakeet',
  version: pkg.version,
  android: {
    ...config.android,
    package: isDev
      ? 'com.adam.tombleson.parakeet.dev'
      : 'com.adam.tombleson.parakeet',
    googleServicesFile: './google-services.json',
    minSdkVersion: 28,                                // Health Connect requirement
  },
  plugins: [
    ...(config.plugins ?? []),
    'react-native-health-connect',
  ],
  extra: {
    ...config.extra,
    buildDate: new Date().toISOString(),
    commitHash: getCommitHash(),
    appEnv: isDev ? 'development' : 'production',
  },
});
```

**Notes:**
- `minSdkVersion: 28` is required — Health Connect APIs are unavailable on Android < 14 in some forms, but the SDK requires API 28+.
- The plugin string `'react-native-health-connect'` resolves to `node_modules/react-native-health-connect/app.plugin.js` (standard Expo convention; verify the file exists after install).
- If the library's plugin requires options (e.g. permission scope tuning), use the array form: `['react-native-health-connect', { /* options */ }]`. Check the library README at the pinned version for current options.

### 3. Manifest permissions

The plugin should inject the following permissions into the merged `AndroidManifest.xml`. Verify after a prebuild that `android/app/src/main/AndroidManifest.xml` (or the EAS-built equivalent) contains:

- `<uses-permission android:name="android.permission.health.READ_HEART_RATE_VARIABILITY" />`
- `<uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />`
- `<uses-permission android:name="android.permission.health.READ_HEART_RATE" />`
- `<uses-permission android:name="android.permission.health.READ_SLEEP" />`
- `<uses-permission android:name="android.permission.health.READ_STEPS" />`
- `<uses-permission android:name="android.permission.health.READ_OXYGEN_SATURATION" />`
- `<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />`
- `<queries>` block declaring intent for `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`

If the plugin does NOT inject all of the above (some libraries default to a subset), use a small wrapper plugin in `apps/parakeet/plugins/withHealthConnectPermissions.ts` that uses `withAndroidManifest` from `@expo/config-plugins` to add the missing entries. Add the wrapper to the `plugins` array instead of the bare string.

### 4. Build & smoke test

Use Nx scripts only (per `feedback_nx_scripts_only.md`). The exact script names live in `package.json`/`docs/guide/dev.md` — do NOT invoke `expo`, `gradle`, or `adb` directly.

- Run the Nx-approved Android dev-client build (e.g. `npm run android` or `npx nx run parakeet:android` — check `docs/guide/dev.md` for the canonical command).
- Boot on a device or emulator with the Health Connect app installed.
- Verify the app launches without `MissingNativeModule` errors for `RNHealthConnect` (or whatever the library exposes).

### 5. EAS production build verification

- Trigger an Android EAS build (production channel) per existing project conventions.
- Confirm the build succeeds without manifest merging errors.
- Confirm the resulting APK installs on a Health-Connect-capable device.

### 6. Update `feature` index

After landing, update [index.md](./index.md) to mark this spec as `implemented` so other phases can proceed.

## Validation

- `npm i react-native-health-connect` succeeds; package present in `package.json`.
- `app.config.ts` typechecks (`npx tsc -p apps/parakeet --noEmit`).
- Native build produces an APK that launches on Android 14+.
- Inside the app, `import { initialize } from 'react-native-health-connect'` resolves at runtime (no missing-native-module error).
- `AndroidManifest.xml` (post-build artifact) contains the 7 permissions above and the rationale `<queries>` block.

## Risks & Mitigations

- **Risk:** Library's `app.plugin.js` lags behind manifest updates required by latest Health Connect API.
  **Mitigation:** Wrapper plugin (Step 3) is the escape hatch.

- **Risk:** Existing dev clients break after plugin add (custom dev clients require rebuild).
  **Mitigation:** Document the rebuild requirement when this lands; bump the dev-client version label so users know to re-install.

- **Risk:** Google Play review flags Health Connect permissions.
  **Mitigation:** Out of scope for this spec; revisit when preparing a Play Store submission. Internal/closed-track distribution is unaffected.

## Out of Scope

- Permission request flow at runtime — see [spec-pipeline.md](./spec-pipeline.md) `requestPermissions()`.
- iOS Health Kit — Parakeet is Android-only.

## Dependencies

- None upstream.
- Downstream: every spec that calls into Health Connect ([spec-pipeline.md](./spec-pipeline.md), [spec-intra-hr.md](./spec-intra-hr.md)) requires this spec to be live.

## References

- `react-native-health-connect` docs — https://matinzd.github.io/react-native-health-connect/
- Expo config plugins guide — https://docs.expo.dev/config-plugins/introduction/
- Android Health Connect permissions reference — https://developer.android.com/health-and-fitness/guides/health-connect/develop/permissions
