const base = require('./jest.config')

module.exports = {
  ...base,
  roots: ['<rootDir>/bench'],
  testRegex: '(.*.bench.ts)',
  testTimeout: 3000000,
}
