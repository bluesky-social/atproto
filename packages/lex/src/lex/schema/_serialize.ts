import {
  CID,
  encodeIpldBytes,
  encodeIpldLink,
  isArray,
  isObject,
  parseIpldBytes,
  parseIpldLink,
} from '../core.js'
import { BlobRef, typedJsonBlobRef, untypedJsonBlobRef } from './_blob-ref.js'

export type JsonScalar = number | string | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }

export type IpldScalar = JsonScalar | CID | Uint8Array
export type Ipld = IpldScalar | Ipld[] | { [key: string]: Ipld }
export type IpldObject = { [key: string]: Ipld }

export type LexScalar = IpldScalar | BlobRef
export type Lex = LexScalar | Lex[] | { [key: string]: Lex }

export function stringifyLex(input: Lex): string {
  return JSON.stringify(input, lexJsonReplacer)
}

function lexJsonReplacer(key: string, value: unknown): unknown {
  if (isObject(value)) {
    if (value instanceof CID) {
      return encodeIpldLink(value)
    } else if (value instanceof Uint8Array) {
      return encodeIpldBytes(value)
    }
    // @NOTE If the object being stringified has a toJSON() method,
    // JSON.stringify() will call it and use the result instead of the original
    // object as "value" argument. This means BlobRef objects will already be
    // converted to their JSON representation before reaching this point, so we
    // don't need to handle them explicitly here.
  }
  return value
}

export function jsonStringToLex(input: string): Lex {
  return JSON.parse(input, lexJsonReviver)
}

function lexJsonReviver(key: string, value: Json): unknown {
  switch (typeof value) {
    case 'object':
      if (value === null) return null
      if (isArray(value)) return value
      return reviveSpecialLexObject(value) || value
    case 'number':
      if (Number.isInteger(value)) return value
      throw new TypeError(`Invalid non-integer number: ${value}`)
    default:
      return value
  }
}

function reviveSpecialLexObject(
  input: JsonObject,
): CID | Uint8Array | BlobRef | undefined {
  // Hot path: use hints to avoid expensive "$validate()" checks

  if (input.$link !== undefined) {
    const cid = parseIpldLink(input)
    if (cid) return cid
  } else if (input.$bytes !== undefined) {
    const bytes = parseIpldBytes(input)
    if (bytes) return bytes
  } else if (input.$type === 'blob') {
    // Using "$validate()" here to coercively parse BlobRef
    const parsed = typedJsonBlobRef.$validate(input)
    if (parsed.success) return BlobRef.fromTypedJsonRef(parsed.value)
  } else if (input.cid !== undefined && input.mimeType !== undefined) {
    // Using "$validate()" here to coercively parse BlobRef
    const parsed = untypedJsonBlobRef.$validate(input)
    if (parsed.success) return BlobRef.fromUntypedJsonRef(parsed.value)
  }

  return undefined
}

export function jsonToLex(value: Json): Lex {
  switch (typeof value) {
    case 'object': {
      if (value === null) return null
      if (isArray(value)) return jsonArrayToLex(value)
      return reviveSpecialLexObject(value) || jsonOjectToLex(value)
    }
    case 'number':
      if (Number.isInteger(value)) return value
      throw new TypeError(`Invalid non-integer number: ${value}`)
    default:
      return value
  }
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

function jsonOjectToLex(input: JsonObject): Record<string, Lex> {
  // Lazily copy value
  let copy: Record<string, Lex> | undefined = undefined
  for (const [key, inputValue] of Object.entries(input)) {
    const value = jsonToLex(inputValue)
    if (value !== inputValue) {
      copy ??= { ...input }
      copy[key] = value
    }
  }
  return copy ?? input
}
