const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copies the MediaPipe pose landmarker model into android/app/src/main/assets/
 * so it's available via Android's AssetManager at runtime.
 * react-native-mediapipe loads models via setModelAssetPath() which reads from APK assets.
 */
function withMediaPipeModel(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const src = path.resolve(__dirname, '..', 'assets', 'models', 'pose_landmarker_full.task');
      const assetsDir = path.resolve(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );

      if (fs.existsSync(src)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.copyFileSync(src, path.join(assetsDir, 'pose_landmarker_full.task'));
      }

      return config;
    },
  ]);
}

module.exports = withMediaPipeModel;
