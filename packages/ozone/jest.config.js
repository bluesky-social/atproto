/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Ozone',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
