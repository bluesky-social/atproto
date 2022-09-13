const path = require('path')
const fs = require('fs')
const { readAll } = require('./_util')


const schemas = readAll()
const result = `export const schemas = [${schemas.map(
    (s) => `${JSON.stringify(s, null, 2)}`
  )}]`

const dirPath = process.argv[2]
if(dirPath) {
  const p = path.join(path.resolve(dirPath), 'defs.ts') 
  fs.writeFileSync(p, result)
}else {
  console.log(result)
}