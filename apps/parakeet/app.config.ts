import type { ConfigContext, ExpoConfig } from 'expo/config';

const isDev = process.env.APP_ENV === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDev ? 'Parakeet (Dev)' : 'Parakeet',
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
    appEnv: isDev ? 'development' : 'production',
  },
});
