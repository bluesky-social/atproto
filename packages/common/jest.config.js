/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Common',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
