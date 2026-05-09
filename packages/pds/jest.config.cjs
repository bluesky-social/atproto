/** @type {import('jest').Config} */
module.exports = {
  displayName: 'PDS',
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      { jsc: { transform: {} }, module: { type: 'es6' } },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(multiformats|uint8arrays))',
  ],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: {
    '^(\\.\\.?\\/.*templates/.+\\.js)$': '$1',
    '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'],
  },
}
