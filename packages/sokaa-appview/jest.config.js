/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Sokaa App View',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  testTimeout: 60000,
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  testPathIgnorePatterns: ['/node_modules/'],
}
