/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Lexicon',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
