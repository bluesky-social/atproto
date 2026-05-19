/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Bsync',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../test.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
