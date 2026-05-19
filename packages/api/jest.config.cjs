/** @type {import('jest').Config} */
module.exports = {
  displayName: 'API',
  transform: { '^.+\\.ts$': '@swc/jest' },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../test.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
