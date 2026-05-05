const {
  withAndroidManifest,
  withMainActivity,
} = require('expo/config-plugins');

const HEALTH_PERMISSIONS = [
  'android.permission.health.READ_HEART_RATE_VARIABILITY',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_OXYGEN_SATURATION',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
];

const IMPORT_LINE =
  'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const SETUP_LINE =
  'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

function withManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    const existing = new Set(
      manifest['uses-permission'].map((p) => p.$?.['android:name'])
    );
    for (const name of HEALTH_PERMISSIONS) {
      if (!existing.has(name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    return config;
  });
}

function withMainActivityHook(config) {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;
    const isKotlin = config.modResults.language === 'kt';
    if (!isKotlin) {
      throw new Error(
        '[with-health-connect-permissions] expected Kotlin MainActivity'
      );
    }

    if (!src.includes(IMPORT_LINE)) {
      src = src.replace(
        /^(package [^\n]+\n)/m,
        `$1\n${IMPORT_LINE}\n`
      );
    }

    if (!src.includes(SETUP_LINE)) {
      if (/super\.onCreate\([^)]*\)/.test(src)) {
        src = src.replace(
          /(super\.onCreate\([^)]*\)[^\n]*\n)/,
          `$1    ${SETUP_LINE}\n`
        );
      } else {
        src = src.replace(
          /(class MainActivity\s*:\s*ReactActivity\(\)\s*\{)/,
          `$1\n  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n    super.onCreate(savedInstanceState)\n    ${SETUP_LINE}\n  }\n`
        );
      }
    }

    config.modResults.contents = src;
    return config;
  });
}

module.exports = (config) => withMainActivityHook(withManifest(config));
