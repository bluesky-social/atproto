const fs = require('node:fs')
const path = require('node:path')

exports.listAllNames = () => {
  return fs.readdirSync(path.join(__dirname, '..', 'src', 'schemas'))
}

exports.readAll = () => {
  const objs = []
  for (const name of exports.listAllNames()) {
    try {
      const file = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'schemas', name),
        'utf8'
      )
      objs.push(JSON.parse(file))
    } catch (e) {
      console.error(`Failed to read ${name}`)
      throw e
    }
  }
  return objs
}
