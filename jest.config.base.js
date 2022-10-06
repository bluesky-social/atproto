// Jest doesn't like ES modules, so we need to transpile them
// For each one, add them to this list, add them to 
// "workspaces.nohoist" in the root package.json, and
// make sure that a babel.config.js is in the package root
const esModules = ['ipld-hashmap', 'get-port', 'node-fetch'].join('|')

// jestconfig.base.js
module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    "^.+\\.js?$": "babel-jest"
  },
  transformIgnorePatterns: [`<rootDir>/node_modules/(?!${esModules})`],
  testRegex: '(/tests/.*.(test|spec)).(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: ["<rootDir>/../../test-setup.ts"],
  verbose: true,
  testTimeout: 30000
}
