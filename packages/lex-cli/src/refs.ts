import {
  Schema,
  isValidRecordSchema,
  isValidMethodSchema,
} from '@atproto/lexicon'
import pointer from 'json-pointer'
import { toCamelCase } from './codegen/util'

export function resolveAllRefs(schemas: Schema[]) {
  for (const schema of schemas) {
    try {
      resolveRefs(schema, schemas)
    } catch (e) {
      console.error('Failed to resolve references in', schema.id)
      throw e
    }
  }
  for (const schema of schemas) {
    try {
      normalizeRefs(schema)
    } catch (e) {
      console.error('Failed to normalize references in', schema.id)
      throw e
    }
  }
}

function normalizeRefs(schema: Schema) {
  for (const [$ref, setRef] of findRefs(schema)) {
    setRef(`#/$defs/${refToKey($ref, schema.id)}`)
  }
}

function resolveRefs(doc: Schema, docs: Schema[]) {
  if (isValidRecordSchema(doc)) {
    if (doc.record) {
      doc.record.$defs = resolveJsonSchemaRefs(doc.record, doc, docs)
    }
  } else if (isValidMethodSchema(doc)) {
    if (doc.input?.schema) {
      doc.input.schema.$defs = resolveJsonSchemaRefs(
        doc.input.schema,
        doc,
        docs,
      )
    }
    if (doc.output?.schema) {
      doc.output.schema.$defs = resolveJsonSchemaRefs(
        doc.output.schema,
        doc,
        docs,
      )
    }
  } else {
    throw new Error('Unknown lexicon schema')
  }
}

function resolveJsonSchemaRefs(
  jsonSchema: any,
  doc: Schema,
  docs: Schema[],
  $defs = {},
): Record<string, any> {
  if (!isObj(jsonSchema)) return {}
  for (const [$ref] of findRefs(jsonSchema)) {
    let targetDoc = doc
    if ($ref.startsWith('lex:')) {
      // external doc ref
      targetDoc = findInput($ref, docs)
    }

    let key = refToKey($ref, targetDoc.id)
    if (!(key in $defs)) {
      // copy the definition into our dictionary
      const def = clone(lookup(targetDoc, $ref))
      $defs[key] = def

      // recurse into the definition
      resolveJsonSchemaRefs(def, targetDoc, docs, $defs)
    }
  }
  return $defs
}

function clone(v: any): any {
  return JSON.parse(JSON.stringify(v))
}

type SetRef = (v: string) => void
function findRefs(obj: Record<string, any>): [string, SetRef][] {
  let items: [string, SetRef][] = []
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref') {
      items.push([
        value,
        (newValue) => {
          obj[key] = newValue
        },
      ])
    } else if (value && typeof value === 'object') {
      items = items.concat(findRefs(value))
    }
  }
  return items
}

function findInput($ref: string, inputs: Schema[]): Schema {
  const id = extractId($ref)
  const input = inputs.find((i) => i.id === id)
  if (!input) {
    throw new Error(`Schema not found: ${$ref}`)
  }
  return input
}

function findAvailableKey($ref: string, $defs: Record<string, any>): string {
  const keys = Object.keys($defs)

  const name = $ref.split('/').pop() || ''
  if (!keys.includes(name)) return name

  let i = 2
  do {
    if (!keys.includes(`${name}${i}`)) return `${name}${i}`
    i++
  } while (i < 1e3)

  throw new Error(`Unable to find a suitable keyname for ${$ref}`)
}

function lookup(obj: any, $ref: string): any {
  const res = pointer.get(obj, $ref.split('#').pop() || '')
  if (!res) throw new Error(`Unable to resolve $ref: ${$ref}`)
  return res
}

const RE = /^lex:([a-z0-9-\.]+)/i
function extractId(v: string): string {
  return RE.exec(v)?.[1] || ''
}

function refToKey(ref: string, id: string): string {
  id = extractId(ref) || id
  const name = ref.split('/').pop() || ''
  return toCamelCase(`${id}.${name}`)
}

function isObj(v: any): v is Object {
  return v && typeof v === 'object' && !Array.isArray(v)
}
