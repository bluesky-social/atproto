const base = require('./jest.config')

module.exports = {
  ...base,
  testRegex: '(/bench/.*.bench)',
  testTimeout: 3000000,
}
