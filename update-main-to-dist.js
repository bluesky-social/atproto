const path = require('path')
const pkgJson = require('@npmcli/package-json')

const [dir] = process.argv.slice(2)

pkgJson
  .load(path.resolve(__dirname, dir))
  .then((pkg) => pkg.update({ main: pkg.content.publishConfig.main }))
  .then((pkg) => pkg.save())
