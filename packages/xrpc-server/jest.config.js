/** @type {import('jest').Config} */
module.exports = {
  displayName: 'XRPC Server',
  transform: { '^.+\\.ts$': '@swc/jest' },
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
