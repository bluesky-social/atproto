const fs = require('node:fs')
const path = require('node:path')

function removeNodeModules() {
  const dirPath = path.join(process.cwd(), 'node_modules')
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
  } catch (error) {
    // Ignore errors
  }
}
module.exports = {
  removeNodeModules,
}
