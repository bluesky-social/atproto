/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Common Web',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
