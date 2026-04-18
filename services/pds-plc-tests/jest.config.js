/** @type {import('jest').Config} */
module.exports = {
  displayName: 'pds-plc-tests',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  testTimeout: 30000,
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
