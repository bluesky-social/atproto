const dts = require('dts-bundle') // package that does this for us
const pkg = require('../package.json')
const path = require('path')

dts.bundle({
  name: pkg.name,
  main: 'dist/src/index.d.ts',
  out: path.resolve(__dirname, '../dist/index.d.ts')
})
