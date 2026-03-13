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
  },
  extra: {
    ...config.extra,
    buildDate: new Date().toISOString(),
    commitHash: getCommitHash(),
    appEnv: isDev ? 'development' : 'production',
  },
});
