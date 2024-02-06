/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Lexicon',
  transform: {
    '^.+\\.(t|j)s?$': '@swc/jest',
  },
}
