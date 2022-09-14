const yaml = require('yaml')
const fs = require('fs')
const path = require('path')

async function wireProtocol() {
  console.log('Converting wire-protocol.yml to .md')
  const yamlStr = fs.readFileSync(
    path.join(__dirname, '..', 'specs', 'wire-protocol.yml'),
    'utf8',
  )
  const api = yaml.parse(yamlStr)

  const routes = []
  const schemas = []
  const doc = [
    `# ${api.info.title} v${api.info.version}`,
    ``,
    api.info.description,
    ``,
    routes,
    `## Schemas`,
    ``,
    schemas,
  ]
  for (const [path, methods] of Object.entries(api.paths)) {
    for (const [methodName, method] of Object.entries(methods)) {
      const route = [`## \`${methodName.toUpperCase()} ${path}\``, ``]
      if (method.summary) {
        route.push(method.summary, ``)
      }
      if (method.parameters?.length) {
        route.push(`### Parameters`, ``)
        route.push(`|Name|In|Description|Required|`)
        route.push(`|-|-|-|-|`)
        for (const param of method.parameters) {
          route.push(
            `|**${param.name}**|${param.in}|${param.description}|${
              param.required ? 'Yes' : 'No'
            }|`,
          )
        }
        route.push('')
      }
      if (method.requestBody) {
        if (
          method.requestBody.content &&
          Object.keys(method.requestBody.content).length > 0
        ) {
          route.push(`### Request body`, ``)
          for (const [mimeType, { schema }] of Object.entries(
            method.requestBody.content,
          )) {
            route.push(`|MimeType|Description|Schema|`)
            route.push(`|-|-|-|`)
            if (schema.$ref) {
              const schemaId = schema.$ref.split('/').pop()
              route.push(
                `|${mimeType}|${
                  method.requestBody.description || '-'
                }|[${schemaId}](#${schemaId.toLowerCase()})|`,
              )
            } else {
              route.push(
                `|${mimeType}|${method.requestBody.description || '-'}|-|`,
              )
            }
          }
          route.push('')
        } else {
          console.log(
            `Warning: ${methodName} ${path} request body not rendered`,
          )
        }
      }
      if (method.responses) {
        route.push(`### Responses`, ``)
        route.push(`|Code|MimeType|Description|Schema|`)
        route.push(`|-|-|-|-|`)
        for (const [code, res] of Object.entries(method.responses)) {
          if (res.content && Object.keys(res.content).length > 0) {
            for (const [mimeType, { schema }] of Object.entries(res.content)) {
              if (schema.$ref) {
                const schemaId = schema.$ref.split('/').pop()
                route.push(
                  `|**${code}**|${mimeType}|${
                    res.description
                  }|[${schemaId}](#${schemaId.toLowerCase()})|`,
                )
              } else {
                route.push(`|**${code}**|${mimeType}|${res.description}|-|`)
              }
            }
          } else {
            route.push(`|**${code}**|-|${res.description}|-|`)
          }
        }
        route.push('')
      }
      routes.push(route)
    }
  }
  for (const [schemaName, schemaDef] of Object.entries(
    api.components.schemas,
  )) {
    schemas.push(`### ${schemaName}`, ``)
    schemas.push(`\`\`\`json`, JSON.stringify(schemaDef, null, 2), `\`\`\``, ``)
  }

  const md = gen(doc)
  fs.writeFileSync(path.join(__dirname, '..', 'specs', 'wire-protocol.md'), md)
}
wireProtocol()

function gen(arr) {
  return arr
    .flat(Infinity)
    .filter((v) => typeof v === 'string')
    .join('\n')
}
