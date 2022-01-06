const withPlugins = require('next-compose-plugins');
const withTM = require('next-transpile-modules')([
  '@bluesky-demo/common',
]);

module.exports = withPlugins([
  withTM,
]);
