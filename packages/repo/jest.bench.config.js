const base = require('./jest.config')

module.exports = {
  ...base,
  testRegex: '(/tests/.*.bench)',
  testTimeout: 3000000
}
