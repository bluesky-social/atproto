/** @type {import('jest').Config} */
module.exports = {
  displayName: 'PDS',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  // For some obscure reason, "tests/proxied/admin.test.ts" requires that all of
  // node_modules gets transformed by SWC, not just "get-port". However,
  // "@puppeteer" does not get properly transformed, resulting in a
  // "ReferenceError: _opts is not defined" in
  // (../../node_modules/.pnpm/@puppeteer+browsers@2.4.0/node_modules/@puppeteer/browsers/lib/cjs/launch.js:123:9)

  // transformIgnorePatterns: ['/node_modules/.pnpm/(?!(get-port)@)'],
  transformIgnorePatterns: [`/node_modules/@puppeteer`],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/../../jest.setup.ts'],
}
