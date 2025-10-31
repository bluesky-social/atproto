import { CID } from 'multiformats/cid'
import { isObject } from '../lib/is-object.js'
import { BlobRef } from './blob-ref.js'
import { encodeLexBytes, parseLexBytes } from './bytes.js'
import { encodeLexLink, parseLexLink } from './cid.js'
import { Json, JsonObject, JsonScalar } from './json.js'

export type LexScalar = JsonScalar | CID | Uint8Array | BlobRef
export type Lex = LexScalar | Lex[] | { [_ in string]?: Lex }
export type LexObject = { [_ in string]?: Lex }
export type LexArray = Lex[]

export function lexStringify(input: Lex): string {
  // @NOTE This check is necessary because JSON.stringify silently returns
  // undefined when given undefined as input, making the returned value not type
  // safe (not a string).
  if (input === undefined) {
    throw new TypeError('Cannot stringify undefined value as Lex')
  }
  return JSON.stringify(input, lexJsonReplacer)
}

export function lexParse(input: string): Lex {
  return JSON.parse(input, lexJsonReviver)
}

export function jsonToLex(value: Json): Lex {
  switch (typeof value) {
    case 'object': {
      if (value === null) return null
      if (Array.isArray(value)) return jsonArrayToLex(value)
      return reviveSpecialObjectSchema(value) || jsonOjectToLex(value)
    }
    case 'number':
      if (Number.isInteger(value)) return value
      throw new TypeError(`Invalid non-integer number: ${value}`)
    default:
      return value
  }
}

function lexJsonReplacer(key: string, value: unknown): unknown {
  if (isObject(value)) {
    if (value instanceof CID) {
      return encodeLexLink(value)
    } else if (value instanceof Uint8Array) {
      return encodeLexBytes(value)
    }
    // @NOTE If the object being stringified has a toJSON() method,
    // JSON.stringify() will call it and use the result instead of the original
    // object as "value" argument. This means BlobRef objects will already be
    // converted to their JSON representation before reaching this point, so we
    // don't need to handle them explicitly here.
  }
  return value
}

function lexJsonReviver(key: string, value: Json): unknown {
  switch (typeof value) {
    case 'object':
      if (value === null) return null
      if (Array.isArray(value)) return value
      return reviveSpecialObjectSchema(value) || value
    case 'number':
      if (Number.isInteger(value)) return value
      throw new TypeError(`Invalid non-integer number: ${value}`)
    default:
      return value
  }
}

function reviveSpecialObjectSchema(
  input: JsonObject,
): CID | Uint8Array | BlobRef | undefined {
  // Hot path: use hints to avoid parsing when possible

  if (input.$link !== undefined) {
    const cid = parseLexLink(input)
    if (cid) return cid
  } else if (input.$bytes !== undefined) {
    const bytes = parseLexBytes(input)
    if (bytes) return bytes
  } else if (input.$type === 'blob') {
    const blobRef = BlobRef.asBlobRef(input)
    if (blobRef) return blobRef
  } else if (input.cid !== undefined && input.mimeType !== undefined) {
    const blobRef = BlobRef.asBlobRef(input)
    if (blobRef) return blobRef
  }

  return undefined
}

function jsonArrayToLex(input: Json[]): Lex[] {
  // Lazily copy value
  let copy: Lex[] | undefined
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = jsonToLex(inputItem)
    if (item !== inputItem) {
      copy ??= Array.from(input)
      copy[i] = item
    }
  }
  return copy ?? input
}

function jsonOjectToLex(input: JsonObject): LexObject {
  // Lazily copy value
  let copy: LexObject | undefined = undefined
  for (const [key, inputValue] of Object.entries(input)) {
    const value = jsonToLex(inputValue)
    if (value !== inputValue) {
      copy ??= { ...input }
      copy[key] = value
    }
  }
  return copy ?? input
}
