/** @type {import('jest').Config} */
module.exports = {
  displayName: 'PDS',
  transform: { '^.+\\.(t|j)s?$': '@swc/jest' },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [`<rootDir>/node_modules/(?!get-port)`],
}
