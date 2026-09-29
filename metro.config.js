// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// The Functions package and kit templates are separate Node projects; keep their
// node_modules/build output out of the app bundle graph and watcher.
const escape = (p) => p.replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [
  new RegExp(`${escape(path.join(__dirname, 'functions', 'node_modules'))}.*`),
  new RegExp(`${escape(path.join(__dirname, 'functions', 'lib'))}.*`),
  new RegExp(`${escape(path.join(__dirname, 'templates'))}.*`),
  new RegExp(`${escape(path.join(__dirname, 'dist-web'))}.*`),
];

// functions/src/shared is compiled by the Functions package under NodeNext (relative imports end in
// '.js'); Metro must resolve those to the TypeScript source when the app imports @shared/*.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (/^\.{1,2}\//.test(moduleName) && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through to the exact path (a real .js file)
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
