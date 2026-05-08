/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Bsync',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      { jsc: { transform: {} }, module: { type: 'es6' } },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [],
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
