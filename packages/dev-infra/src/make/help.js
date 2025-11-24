const fs = require('node:fs')
const path = require('node:path')

const Makefile = 'Makefile'
const colors = {
  boldGreen: '\x1b[01;32m',
  reset: '\x1b[0m',
}

function displayMakeHelp() {
  console.log('Helper Commands:')
  console.log()

  const makefilePath = path.join(process.cwd(), Makefile)

  if (!fs.existsSync(makefilePath)) {
    process.exit(1)
  }

  try {
    const fileContent = fs.readFileSync(makefilePath, 'utf8')
    const lines = fileContent.split('\n')

    // `grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$'`
    // It finds lines that start with a valid make target name, followed by a colon,
    // and contain '##' which we use as a delimiter for the help text.
    const helpLineRegex = /^[a-zA-Z0-9_-]+:.*?## .*/

    lines
      .filter((line) => helpLineRegex.test(line))
      .forEach((line) => {
        // `awk 'BEGIN {FS = ":.*?## "}; {printf "...", $1, $2}'`

        // 1. Split the line into two parts at the '##' comment marker.
        const parts = line.split('##')
        const targetPart = parts[0]
        const helpText = parts[1].trim()

        // 2. Get the target name by splitting the first part at the colon.
        const target = targetPart.split(':')[0].trim()

        // 3. Format the output string.
        // `padEnd` provides the left-aligned padding just like `%-20s` in awk/printf.
        const paddedTarget = target.padEnd(20)

        const output = `    ${colors.boldGreen}${paddedTarget}${colors.reset} ${helpText}`
        console.log(output)
      })
  } catch (err) {
    process.exit(1)
  }

  console.log()
  console.log(
    "NOTE: dependencies between commands are not automatic. Eg, you must run 'deps' and 'build' first, and after any changes",
  )
}
module.exports = {
  displayMakeHelp,
}
