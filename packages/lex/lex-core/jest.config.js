/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript', decorators: true } } },
    ],
  },
  moduleNameMapper: { '^(\\.\\.?\\/.+)\\.js$': ['$1.ts', '$1.js'] },
}
