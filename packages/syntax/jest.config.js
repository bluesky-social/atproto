/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Syntax',
  transform: {
    '^.+\\.(t|j)s?$': '@swc/jest',
  },
}
