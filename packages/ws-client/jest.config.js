/** @type {import('jest').Config} */
module.exports = {
  displayName: 'WebSocket Client',
  transform: { '^.+\\.(j|t)s$': '@swc/jest' },
  transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
  forceExit: true,
}
