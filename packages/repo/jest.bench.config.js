const base = require('./jest.config')

module.exports = {
  ...base,
  roots: ['<rootDir>/bench'],
  testRegex: '(.*.bench)',
  testTimeout: 3000000,
}
