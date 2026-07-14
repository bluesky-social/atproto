/** @type {import('jest').Config} */
module.exports = {
  displayName: 'OAuth Scopes',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      { jsc: { transform: {} }, module: { type: 'es6' } },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [],
  setupFiles: ['<rootDir>/../../../test.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
