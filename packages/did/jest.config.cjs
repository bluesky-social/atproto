/** @type {import('jest').Config} */
module.exports = {
  displayName: 'DID',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../test.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
