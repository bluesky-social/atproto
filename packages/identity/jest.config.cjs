/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Identity',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  setupFiles: ['<rootDir>/../../test.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
