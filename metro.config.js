const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {};

// Note: wrapWithReanimatedMetroConfig removed — it has a bug where enhanceMiddleware
// returns undefined, crashing Metro on startup. Reanimated works fine without it in RN 0.76.
module.exports = mergeConfig(getDefaultConfig(__dirname), config);
