/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Bsync',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
