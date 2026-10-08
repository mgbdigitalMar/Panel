// Metro config: lets the app import the platform-agnostic code in ../shared
// (same services and constants the web uses) and maps Node's `crypto`
// (required by bcryptjs) to a React Native shim backed by expo-crypto.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = getDefaultConfig(projectRoot);

// Bundled PDFs (internal rules document) are shipped as assets.
config.resolver.assetExts = [...config.resolver.assetExts, 'pdf'];

config.watchFolders = [...(config.watchFolders || []), sharedRoot];

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
const cryptoShim = path.resolve(projectRoot, 'src/shims/crypto.js');
const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'crypto') {
    return { type: 'sourceFile', filePath: cryptoShim };
  }
  if (moduleName.startsWith('@shared/')) {
    return context.resolveRequest(context, path.join(sharedRoot, moduleName.slice('@shared/'.length)), platform);
  }
  return (defaultResolve || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
