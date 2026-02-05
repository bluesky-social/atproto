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
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/team.test.ts',
    '/tests/verification.test.ts',
  ],
  forceExit: true,
}
