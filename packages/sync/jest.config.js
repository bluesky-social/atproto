/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Sync',
  transform: { '^.+\\.ts$': '@swc/jest' },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
