const { removeNodeModules } = require('./clean')
const { displayMakeHelp } = require('./help')

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes('--clean')) {
    removeNodeModules()
  } else {
    displayMakeHelp()
  }
}
