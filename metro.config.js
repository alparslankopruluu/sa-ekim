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

module.exports = config;
