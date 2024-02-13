/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Crypto',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
