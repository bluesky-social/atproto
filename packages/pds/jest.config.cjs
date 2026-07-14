/** @type {import('jest').Config} */
module.exports = {
  displayName: 'PDS',
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', importAttributes: true },
          experimental: { keepImportAttributes: true },
          transform: {},
        },
        module: { type: 'es6' },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(multiformats|uint8arrays))',
  ],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../test.setup.ts'],
  moduleNameMapper: {
    '^\\.\\/templates/(.+\\.js)$': '<rootDir>/dist/mailer/templates/$1',
    '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'],
  },
}
