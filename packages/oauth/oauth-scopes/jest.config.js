/** @type {import('jest').Config} */
module.exports = {
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
