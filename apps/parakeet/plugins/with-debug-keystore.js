const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copies keystores/debug.keystore into android/app/ after prebuild,
 * so the signing key stays stable across prebuild --clean runs.
 */
function withDebugKeystore(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const src = path.resolve(__dirname, '..', 'keystores', 'debug.keystore');
      const dst = path.resolve(
        config.modRequest.platformProjectRoot,
        'app',
        'debug.keystore'
      );
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
      return config;
    },
  ]);
}

module.exports = withDebugKeystore;
