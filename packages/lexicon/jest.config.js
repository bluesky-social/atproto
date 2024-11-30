/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Lexicon',
  transform: { '^.+\\.ts$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
