/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Sync',
  transform: {
    '^.+\\.(t|j)s$': ['@swc/jest', { jsc: { transform: {} }, module: { type: 'es6' } }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
