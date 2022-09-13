const { readAll } = require('./_util')
const toTs = require('json-schema-to-typescript')

;(async () => {
  const schemas = readAll()
  schemas.sort((a, b) => {
    if (a.$type === 'adxs-collection' && b.$type !== 'adxs-collection') {
      return -1
    }
    if (a.$type !== 'adxs-collection' && b.$type === 'adxs-collection') {
      return 1
    }
    if (a.$type === 'adxs-record' && b.$type !== 'adxs-record') {
      return -1
    }
    if (a.$type !== 'adxs-record' && b.$type === 'adxs-record') {
      return 1
    }
    return a.name.localeCompare(b.name)
  })

  const out = []
  for (const s of schemas) {
    out.push(`## ${getType(s)}: ${s.name}`)
    out.push('')
    out.push(outJson(s, 'Full Definition'))
    out.push('')
    out.push(s.$comment ? `${s.$comment + '\n'}` : '')
    out.push('')
    if (s.$type === 'adxs-collection') {
      continue
    }
    out.push('**Interface**')
    if (s.parameters) out.push(await outTs(s.parameters, 'Params'))
    if (s.response) out.push(await outTs(s.response, 'Response'))
    if (s.schema) out.push(await outTs(s.schema, 'Record'))
    if (s.$ext?.['adxs-doc']?.examples) {
      out.push('**Examples**')
      for (const ex of s.$ext?.['adxs-doc']?.examples) {
        out.push('')
        out.push('```json')
        out.push(JSON.stringify(ex, null, 2))
        out.push('```')
        out.push('')
      }
    }
    out.push('')
  }
  console.log(out.join('\n'))
})()

function getType(schema) {
  if (schema.$type === 'adxs-record') {
    return 'Record'
  }
  if (schema.$type === 'adxs-collection') {
    return 'Collection'
  }
  if (schema.$type === 'adxs-view') {
    return 'View'
  }
}

function outJson(v, title) {
  if (v) {
    return `<details><summary>${title}</summary><pre><code>${JSON.stringify(
      v,
      null,
      2
    )}</code></pre></details>\n`
  }
  return ''
}

async function outTs(v, title) {
  if (v) {
    if (v['$ref']) {
      // HACK to workaround an issue with cyclic refs
      Object.assign(v, v['$defs']['post'])
      delete v['$ref']
    }
    return `\`\`\`typescript\n${await toTs.compile(
      Object.assign({ title }, v),
      undefined,
      {
        bannerComment: '',
      }
    )}\`\`\``
  }
  return ''
}
