/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Ozone',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: [
    `/node_modules/.pnpm/(?!(get-port|lande|toygrad)@)`,
  ],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  // Sokaa: skip server.test.ts — it uses TestNetwork (full bsky+ozone+PDS+PLC
  // stack) which times out in afterAll during network.close() on CI.
  // Ozone is Bluesky's moderation service and is not part of the Sokaa stack.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/server.test.ts'],
}
