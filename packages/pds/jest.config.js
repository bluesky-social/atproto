/** @type {import('jest').Config} */
module.exports = {
  displayName: 'PDS',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  // Jest requires all ESM dependencies to be transpiled (even if they are
  // dynamically import()ed).
  transformIgnorePatterns: [
    `/node_modules/.pnpm/(?!(get-port|lande|toygrad)@)`,
  ],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  // Sokaa: skip tests that require a live Bluesky AppView (SOK-34).
  // - proxied/: all 8 tests proxy app.bsky.* queries to an AppView that
  //   doesn't exist in the Sokaa deployment.
  // - oauth.test.ts: Puppeteer E2E test for the bsky OAuth client browser
  //   example; requests app.bsky.actor.getPreferences scope.
  // - account-migration.test.ts: core com.atproto migration logic is fine but
  //   the test calls app.bsky.actor.getPreferences and app.bsky.feed.post
  //   at the end, which fail without an AppView.
  // These will be replaced with app.sokaa.* equivalents in a follow-up.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/proxied/',
    '<rootDir>/tests/oauth.test.ts',
    '<rootDir>/tests/account-migration.test.ts',
    '<rootDir>/tests/preferences.test.ts',
  ],
}
