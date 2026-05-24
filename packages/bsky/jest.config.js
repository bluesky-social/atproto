/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Bsky App View',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  // Sokaa: skip bsky AppView tests that are not part of the Sokaa stack (SOK-34).
  // thread.test.ts: tests bsky listblock + takedown label moderation behavior.
  // The test "doesn't apply listblock if list was taken down by takedown label"
  // has a missing `await network.processAll()` before the first getPostThread
  // call (line 571) — the AppView hasn't indexed the listblock yet, causing
  // "Post not found". Filed for upstream contribution to bluesky-social/atproto.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/views/thread.test.ts',
  ],
}
