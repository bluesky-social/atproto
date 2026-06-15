/** @type {import('jest').Config} */
const ciE2eIgnore = process.env.CI ? ['<rootDir>/tests/sokaa-e2e.test.ts'] : []

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
  // Sokaa: skip bsky AppView proxy tests (SOK-34). sokaa-proxy.test.ts lives in
  // tests/ (not proxied/) and runs in CI.
  // sokaa-e2e.test.ts spins up TestNetworkSokaa; open handles can prevent Jest
  // from exiting in CI shards. Same paths are covered by integration-tests.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/proxied/',
    '<rootDir>/tests/oauth.test.ts',
    '<rootDir>/tests/account-migration.test.ts',
    '<rootDir>/tests/preferences.test.ts',
    ...ciE2eIgnore,
  ],
}
