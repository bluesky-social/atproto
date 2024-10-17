/** @type {import('jest').Config} */
module.exports = {
  displayName: 'XRPC Server',
  transform: { '^.+\\.(j|t)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
