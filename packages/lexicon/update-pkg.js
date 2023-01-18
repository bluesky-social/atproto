const pkgJson = require('@npmcli/package-json')

if (process.argv.includes('--update-main-to-dist')) {
  return pkgJson
    .load(__dirname)
    .then((pkg) => pkg.update({ main: 'dist/index.js' }))
    .then((pkg) => pkg.save())
}
if (process.argv.includes('--update-main-to-src')) {
  return pkgJson
    .load(__dirname)
    .then((pkg) => pkg.update({ main: 'src/index.ts' }))
    .then((pkg) => pkg.save())
}
