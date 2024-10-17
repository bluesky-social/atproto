/** @type {import('jest').Config} */
module.exports = {
  displayName: 'API',
  transform: { '^.+\\.ts$': '@swc/jest' },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}
