const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

// Safely add 'wasm' to web fileExtensions if web config exists
if (config.web && config.web.config && config.web.config.fileExtensions) {
  config.web.config.fileExtensions.push('wasm');
}

module.exports = withNativeWind(config, { input: './global.css' });
