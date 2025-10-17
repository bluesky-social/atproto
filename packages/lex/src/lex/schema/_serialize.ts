import { CID, isArray, isObject, parseIpldBytes, ui8ToBase64 } from '../core.js'
import { BlobRef, typedJsonBlobRef, untypedJsonBlobRef } from './_blob-ref.js'

export type JsonScalar = number | string | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: Json }

export type IpldScalar = JsonScalar | CID | Uint8Array
export type Ipld = IpldScalar | Ipld[] | { [key: string]: Ipld }

export type LexScalar = IpldScalar | BlobRef
export type Lex = LexScalar | Lex[] | { [key: string]: Lex }

export function stringifyLex(input: Lex): string {
  return JSON.stringify(input, lexJsonReplacer)
}

function lexJsonReplacer(key: string, value: unknown): unknown {
  if (isObject(value)) {
    if (value instanceof CID) {
      return { $link: value.toString() }
    } else if (value instanceof Uint8Array) {
      return { $bytes: ui8ToBase64(value) }
    }
    // @NOTE If the object being stringified has a toJSON() method,
    // JSON.stringify() will call it and use the  result instead of the original
    // object.
    // This means BlobRef objects will already be converted to their JSON
    // representation before reaching this point, so we don't need to handle
    // them explicitly here.
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

function reviveSpecialLexObject(
  input: Record<string, Json>,
): CID | Uint8Array | BlobRef | undefined {
  // Hot path: use hints to avoid expensive "$is()" checks

  if ('$link' in input) {
    if (typeof input['$link'] === 'string' && Object.keys(input).length === 1) {
      return CID.parse(input['$link'])
    }
  } else if ('$bytes' in input) {
    const bytes = parseIpldBytes(input)
    if (bytes) return bytes
  } else if ('$type' in input) {
    if (input['$type'] === 'blob' && typedJsonBlobRef.$is(input)) {
      return BlobRef.fromJsonRef(input)
    }
  } else if ('cid' in input && 'mimeType' in input) {
    if (
      typeof input['cid'] === 'string' &&
      typeof input['mimeType'] === 'string' &&
      untypedJsonBlobRef.$is(input)
    ) {
      return BlobRef.fromJsonRef(input)
    }
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

function jsonOjectToLex(input: Record<string, Json>): Record<string, Lex> {
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
