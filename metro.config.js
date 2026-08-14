const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .glb is the only asset type the default Expo config does not already know
// about, and it is the one every object in the library ships.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'glb'])];

module.exports = config;
