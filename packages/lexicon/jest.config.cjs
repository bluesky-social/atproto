/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Lexicon',
  transform: { '^.+\\.ts$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../test.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
