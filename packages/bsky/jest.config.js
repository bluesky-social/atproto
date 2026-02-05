/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Bsky App View',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/views/thread-v2.test.ts',
    '/tests/views/thread.test.ts',
    '/tests/views/suggested-follows.test.ts',
  ],
  forceExit: true,
}
