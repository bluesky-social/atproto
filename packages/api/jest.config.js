/** @type {import('jest').Config} */
module.exports = {
  displayName: 'API',
  transform: { '^.+\\.ts$': '@swc/jest' },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  // Sokaa: skip tests that require a live Bluesky AppView (SOK-34).
  // atp-agent and moderation-prefs call app.bsky.actor.getPreferences /
  // putPreferences which early-exit in TestNetworkNoAppView (no bskyAppView
  // configured), leaving the XRPC method unregistered → "Upstream service
  // unreachable". These are pre-existing failures unrelated to Sokaa's stack.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/atp-agent.test.ts',
    '<rootDir>/tests/moderation-prefs.test.ts',
  ],
}
