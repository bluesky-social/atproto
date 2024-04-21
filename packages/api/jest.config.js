/** @type {import('jest').Config} */
module.exports = {
  displayName: 'API',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  transformIgnorePatterns: [`<rootDir>/node_modules/(?!get-port)`],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}
