import fs from 'fs'
import { join } from 'path'
import { methodSchema, MethodSchema, recordSchema, Schema } from '@adxp/lexicon'
import chalk from 'chalk'
import { GeneratedAPI, FileDiff } from './types'

export function schemaTemplate(nsid: string, options?: Record<string, string>) {
  return {
    xrpc: 1,
    id: nsid,
    type: options?.type || '',
    description: options?.desc || '',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  }
}

export function readAllSchemas(paths: string[]): Schema[] {
  const schemas: any[] = []
  for (const path of paths) {
    if (!path.endsWith('.json') || !fs.statSync(path).isFile()) {
      continue
    }
    try {
      schemas.push(readSchema(path))
    } catch (e: any) {
      // skip
    }
  }
  return schemas
}

export function readSchema(path: string): Schema {
  let str: string
  let obj: any
  try {
    str = fs.readFileSync(path, 'utf8')
  } catch (e) {
    console.error(`Failed to read file`, path)
    throw e
  }
  try {
    obj = JSON.parse(str)
  } catch (e) {
    console.error(`Failed to parse JSON in file`, path)
    throw e
  }
  if (obj.type === 'query' || obj.type === 'procedure') {
    try {
      return methodSchema.parse(obj)
    } catch (e) {
      console.error(`Invalid method schema in file`, path)
      throw e
    }
  } else if (obj.type === 'record') {
    try {
      return recordSchema.parse(obj)
    } catch (e) {
      console.error(`Invalid record schema in file`, path)
      throw e
    }
  } else {
    console.error(`Not lexicon schema`, path)
    throw new Error(`Not lexicon schema`)
  }
}

export function genMd(schemas: Schema[]) {
  let doc: StringTree = []
  for (const schema of schemas) {
    if (methodSchema.parse(schema)) {
      doc = doc.concat(genMethodSchemaMd(schema as MethodSchema))
    } else if (recordSchema.parse(schema)) {
      // TODO
    }
  }
  return merge(doc)
}

export function genMethodSchemaMd(schema: MethodSchema): StringTree {
  const desc: StringTree = []
  const params: StringTree = []
  const input: StringTree = []
  const output: StringTree = []
  const doc: StringTree = [`## ${schema.id}`, '', desc, params, input, output]

  desc.push(`(${schema.type}) ${schema.description || ''}`, ``)

  if (schema.parameters && Object.keys(schema.parameters).length) {
    params.push(`Parameters:`, ``)
    for (const [k, desc] of Object.entries(schema.parameters)) {
      const param: string[] = []
      param.push(`- \`${k}\``)
      param.push(desc.required ? `Required` : `Optional`)
      param.push(`${desc.type}.`)
      if (desc.description) {
        param.push(desc.description)
      }
      if (desc.type === 'string') {
        if (typeof desc.maxLength !== 'undefined') {
          param.push(`Max length ${desc.maxLength}.`)
        }
        if (typeof desc.minLength !== 'undefined') {
          param.push(`Min length ${desc.minLength}.`)
        }
      } else if (desc.type === 'number' || desc.type === 'integer') {
        if (typeof desc.maximum !== 'undefined') {
          param.push(`Max value ${desc.maximum}.`)
        }
        if (typeof desc.minimum !== 'undefined') {
          param.push(`Min value ${desc.minimum}.`)
        }
      }
      if (typeof desc.default !== 'undefined') {
        param.push(`Defaults to ${desc.default}.`)
      }
      params.push(param.join(' '))
    }
  }
  params.push('')

  if (schema.input) {
    input.push(`Input:`, ``)
    if (schema.input.encoding) {
      if (typeof schema.input.encoding === 'string') {
        input.push(`- Encoding: ${schema.input.encoding}`)
      } else if (Array.isArray(schema.input.encoding)) {
        input.push(`- Possible encodings: ${schema.input.encoding.join(', ')}`)
      }
    }
    if (schema.input.schema) {
      input.push(`- Schema:`, ``)
      input.push('```json')
      input.push(JSON.stringify(schema.input.schema, null, 2))
      input.push('```')
    }
    input.push('')
  }

  if (schema.output) {
    output.push(`Output:`, ``)
    if (schema.output.encoding) {
      if (typeof schema.output.encoding === 'string') {
        output.push(`- Encoding: ${schema.output.encoding}`)
      } else if (Array.isArray(schema.output.encoding)) {
        output.push(
          `- Possible encodings: ${schema.output.encoding.join(', ')}`,
        )
      }
    }
    if (schema.output.schema) {
      output.push(`- Schema:`, ``)
      output.push('```json')
      output.push(JSON.stringify(schema.output.schema, null, 2))
      output.push('```')
    }
    output.push('')
  }

  return doc
}

export function genTsObj(schemas: Schema[]): string {
  return `export const schemas = ${JSON.stringify(schemas, null, 2)}`
}

export function genFileDiff(outDir: string, api: GeneratedAPI) {
  const diffs: FileDiff[] = []
  const existingFiles = readdirRecursiveSync(outDir)

  for (const file of api.files) {
    file.path = join(outDir, file.path)
    if (existingFiles.includes(file.path)) {
      diffs.push({ act: 'mod', path: file.path, content: file.content })
    } else {
      diffs.push({ act: 'add', path: file.path, content: file.content })
    }
  }
  for (const filepath of existingFiles) {
    if (api.files.find((f) => f.path === filepath)) {
      // do nothing
    } else {
      diffs.push({ act: 'del', path: filepath })
    }
  }

  return diffs
}

export function printFileDiff(diff: FileDiff[]) {
  for (const d of diff) {
    switch (d.act) {
      case 'add':
        console.log(`${chalk.greenBright('[+ add]')} ${d.path}`)
        break
      case 'mod':
        console.log(`${chalk.yellowBright('[* mod]')} ${d.path}`)
        break
      case 'del':
        console.log(`${chalk.redBright('[- del]')} ${d.path}`)
        break
    }
  }
}

export function applyFileDiff(diff: FileDiff[]) {
  for (const d of diff) {
    switch (d.act) {
      case 'add':
      case 'mod':
        fs.mkdirSync(join(d.path, '..'), { recursive: true }) // lazy way to make sure the parent dir exists
        fs.writeFileSync(d.path, d.content || '', 'utf8')
        break
      case 'del':
        fs.unlinkSync(d.path)
        break
    }
  }
}

function readdirRecursiveSync(
  root: string,
  files: string[] = [],
  prefix: string = '',
) {
  var dir = join(root, prefix)
  if (!fs.existsSync(dir)) return files
  if (fs.statSync(dir).isDirectory())
    fs.readdirSync(dir).forEach(function (name) {
      readdirRecursiveSync(root, files, join(prefix, name))
    })
  else if (prefix.endsWith('.ts')) {
    files.push(join(root, prefix))
  }

  return files
}

type StringTree = (StringTree | string | undefined)[]
function merge(arr: StringTree): string {
  return arr
    .flat(10)
    .filter((v) => typeof v === 'string')
    .join('\n')
}
