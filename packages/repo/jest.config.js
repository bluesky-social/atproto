/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Repo',
  transform: {
    '^.+\\.(t|j)s?$': '@swc/jest',
  },
}
