/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Common Web',
  transform: {
    '^.+\\.(t|j)s$': [
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
  transformIgnorePatterns: [],
  setupFiles: ['<rootDir>/../../test.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
