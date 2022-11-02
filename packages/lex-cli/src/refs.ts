import {
  Schema,
  isValidRecordSchema,
  isValidMethodSchema,
  isValidTokenSchema,
} from '@atproto/lexicon'
import pointer from 'json-pointer'
import { toCamelCase } from './codegen/util'

interface NameInfo {
  nsid: string
  name: string
}

/**
 * NOTE
 * The goal of this method is to lift all references, including cross-document references,
 * into the JSON-Schemas within the lexicon docs (in their $defs key). This solves a few problems:
 *
 * 1. It enables $refs to go to other documents using lex: URIs
 * 2. It correctly anchors $refs against the base of the lexicon document
 *    rather than against the JSON-schemas within documents
 *
 * This code isn't the cleanest I've ever written, but it gets the job done for now.
 * -prf
 */
export function resolveAllRefs(schemas: Schema[]) {
  const keysToNameInfo: Map<string, NameInfo> = new Map()

  /**
   * Step 1
   * Gather all of the referenced definitions into the documents using them.
   * These definitions are placed in the $def of each JSON-Schema, and
   * they have their keynames normalized using refToKey().
   */
  for (const schema of schemas) {
    try {
      resolveRefs(schema, schemas, keysToNameInfo)
    } catch (e) {
      console.error('Failed to resolve references in', schema.id)
      throw e
    }
  }

  /**
   * Step 2
   * Find all $ref pointers and update them to point to the local $defs
   */
  for (const schema of schemas) {
    try {
      for (const [$ref, setRef] of findRefs(schema)) {
        setRef(`#/$defs/${refToKey($ref, schema.id)}`)
      }
    } catch (e) {
      console.error('Failed to normalize references in', schema.id)
      throw e
    }
  }

  /**
   * Step 3
   * Simplify the names used in the $defs to improve the quality of the generated code
   */
  for (const schema of schemas) {
    try {
      simplifyDefs(schema, keysToNameInfo)
    } catch (e) {
      console.error('Failed to simplify references in', schema.id)
      throw e
    }
  }
}

function resolveRefs(
  doc: Schema,
  docs: Schema[],
  keysToNameInfo: Map<string, NameInfo>,
) {
  if (isValidRecordSchema(doc)) {
    if (doc.record) {
      doc.record.$defs = resolveJsonSchemaRefs(
        doc.record,
        doc,
        docs,
        {},
        keysToNameInfo,
      )
    }
  } else if (isValidMethodSchema(doc)) {
    if (doc.input?.schema) {
      doc.input.schema.$defs = resolveJsonSchemaRefs(
        doc.input.schema,
        doc,
        docs,
        {},
        keysToNameInfo,
      )
    }
    if (doc.output?.schema) {
      doc.output.schema.$defs = resolveJsonSchemaRefs(
        doc.output.schema,
        doc,
        docs,
        {},
        keysToNameInfo,
      )
    }
  } else if (isValidTokenSchema(doc)) {
    // ignore
  } else {
    throw new Error('Unknown lexicon schema')
  }
}

function resolveJsonSchemaRefs(
  jsonSchema: any,
  doc: Schema,
  docs: Schema[],
  $defs: Record<string, any>,
  keysToNameInfo: Map<string, NameInfo>,
): Record<string, any> {
  if (!isObj(jsonSchema)) return {}

  for (const [$ref] of findRefs(jsonSchema)) {
    let targetDoc = doc
    if ($ref.startsWith('lex:')) {
      // external doc ref
      targetDoc = findInput($ref, docs)
    }

    let key = refToKey($ref, targetDoc.id)
    keysToNameInfo.set(key, {
      nsid: targetDoc.id,
      name: $ref.split('/').filter(Boolean).pop() || '',
    })
    if (!(key in $defs)) {
      // copy the definition into our dictionary
      const def = clone(lookup(targetDoc, $ref))
      $defs[key] = def

      // recurse into the definition
      resolveJsonSchemaRefs(def, targetDoc, docs, $defs, keysToNameInfo)
    }
  }
  return $defs
}

function simplifyDefs(doc: Schema, keysToNameInfo: Map<string, NameInfo>) {
  const usedNames: Set<string> = new Set()
  const finalNames: Map<string, string> = new Map()

  const updateDefs = ($defs: Record<string, any> | undefined) => {
    if ($defs) {
      for (const oldKey of Object.keys($defs)) {
        const newKey = findSimplestKey(
          oldKey,
          keysToNameInfo.get(oldKey),
          usedNames,
        )
        finalNames.set(oldKey, newKey)
        usedNames.add(newKey)
        if (newKey !== oldKey) {
          $defs[newKey] = $defs[oldKey]
          delete $defs[oldKey]
        }
      }
    }
  }

  if (isValidRecordSchema(doc)) {
    updateDefs(doc.record?.$defs)
  } else if (isValidMethodSchema(doc)) {
    updateDefs(doc.input?.schema?.$defs)
    updateDefs(doc.output?.schema?.$defs)
  } else if (isValidTokenSchema(doc)) {
    // ignore
  } else {
    throw new Error('Unknown lexicon schema')
  }

  for (const [$ref, setRef] of findRefs(doc)) {
    const oldKey = $ref.split('/').pop() || ''
    setRef(`#/$defs/${finalNames.get(oldKey) || oldKey}`)
  }
}

function findSimplestKey(
  oldKey: string,
  nameInfo: NameInfo | undefined,
  usedNames: Set<string>,
) {
  if (nameInfo) {
    if (!usedNames.has(nameInfo.name)) {
      return nameInfo.name
    }
    if (
      !usedNames.has(
        toCamelCase(nameInfo.nsid.split('.').pop() + '.' + nameInfo.name),
      )
    ) {
      return toCamelCase(nameInfo.nsid.split('.').pop() + '.' + nameInfo.name)
    }
  }
  return oldKey
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

function lookup(obj: any, $ref: string): any {
  const res = pointer.get(obj, $ref.split('#').pop() || '')
  if (!res) throw new Error(`Unable to resolve $ref: ${$ref}`)
  return res
}

const RE = /^lex:([a-z0-9-.]+)/i
function extractId(v: string): string {
  return RE.exec(v)?.[1] || ''
}

function refToKey(ref: string, id: string): string {
  id = extractId(ref) || id
  const name = ref.split('/').filter(Boolean).pop() || ''
  return toCamelCase(`${id}.${name}`)
}

function isObj(v: any): v is object {
  return v && typeof v === 'object' && !Array.isArray(v)
}
