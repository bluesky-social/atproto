/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Tap',
  transform: { '^.+\\.(j|t)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
}
