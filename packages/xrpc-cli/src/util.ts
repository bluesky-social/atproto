import fs from 'fs'
import { methodSchema, MethodSchema } from '@adxp/xrpc'
import { adxSchemaDefinition, AdxSchemaDefinition } from '@adxp/schemas'
import { Schema } from './types'

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
  if (obj.xrpc === 1) {
    try {
      return methodSchema.parse(obj)
    } catch (e) {
      console.error(`Invalid XRPC schema in file`, path)
      throw e
    }
  } else if (obj.adx === 1) {
    try {
      return adxSchemaDefinition.parse(obj)
    } catch (e) {
      console.error(`Invalid ADX schema in file`, path)
      throw e
    }
  } else {
    console.error(`Not an xrpc or adx schema`, path)
    throw new Error(`Not an xrpc or adx schema`)
  }
}

export function genMd(schemas: Schema[]) {
  let doc: StringTree = []
  for (const schema of schemas) {
    if (methodSchema.parse(schema)) {
      doc = doc.concat(genMethodSchemaMd(schema as MethodSchema))
    } else if (adxSchemaDefinition.parse(schema)) {
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

type StringTree = (StringTree | string | undefined)[]
function merge(arr: StringTree): string {
  return arr
    .flat(10)
    .filter((v) => typeof v === 'string')
    .join('\n')
}
