const path = require('path')
const fs = require('fs')
const { readAll } = require('./_util')
const toTs = require('json-schema-to-typescript')

let dirPath = process.argv[2]
if (!dirPath) {
  throw new Error('Please specify the output folder')
}
dirPath = path.resolve(dirPath)

const files = []

;(async () => {
  const schemas = readAll()
  schemas.sort((a, b) => {
    return a.name.localeCompare(b.name)
  })

  const indexJs = []
  for (const s of schemas) {
    if (s.$type === 'adxs-collection') {
      continue
    }
    const out = []
    if (s.parameters) out.push(await outTs(s.parameters, 'Params'))
    if (s.response) out.push(await outTs(s.response, 'Response'))
    if (s.schema) out.push(await outTs(s.schema, 'Record'))
    files.push({ name: `${s.name}.ts`, content: out.join('\n') })
    indexJs.push(`export * as ${s.name} from './${s.name}'`)
  }

  console.log('writing', path.join(dirPath, 'index.ts'))
  fs.writeFileSync(path.join(dirPath, 'index.ts'), indexJs.join('\n'))
  for (const f of files) {
    console.log('writing', path.join(dirPath, f.name))
    fs.writeFileSync(path.join(dirPath, f.name), f.content)
  }
})()

async function outTs(v, title) {
  if (v) {
    if (v['$ref']) {
      // HACK to workaround an issue with cyclic refs
      Object.assign(v, v['$defs']['post'])
      delete v['$ref']
    }
    return await toTs.compile(Object.assign({ title }, v), undefined, {
      bannerComment: '',
      additionalProperties: false,
    })
  }
  return ''
}
