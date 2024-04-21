/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Lexicon',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: [`<rootDir>/node_modules/(?!get-port)`],
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
