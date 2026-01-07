import {
  BlobRef,
  Cid,
  LexArray,
  LexMap,
  LexValue,
  isCid,
} from '@atproto/lex-data'
import { parseBlobRef } from './blob.js'
import { encodeLexBytes, parseLexBytes } from './bytes.js'
import { JsonObject, JsonValue } from './json.js'
import { encodeLexLink, parseLexLink } from './link.js'

export function lexStringify(input: LexValue): string {
  // @NOTE Because of the way the "replacer" works in JSON.stringify, it's
  // simpler to convert Lex to JSON first rather than trying to do it
  // on-the-fly.
  return JSON.stringify(lexToJson(input))
}

export type LexParseOptions = {
  /**
   * Forbids the presence of invalid Lex values (e.g. non-integer numbers,
   * malformed $link, $bytes, blob objects, etc.)
   */
  strict?: boolean
}

export function lexParse<T extends LexValue = LexValue>(
  input: string,
  options: LexParseOptions = { strict: false },
): T {
  return JSON.parse(input, function (key: string, value: JsonValue): LexValue {
    switch (typeof value) {
      case 'object':
        if (value === null) return null
        if (Array.isArray(value)) return value
        return parseSpecialJsonObject(value, options) ?? value
      case 'number':
        if (Number.isInteger(value) && Number.isSafeInteger(value)) return value
        if (options.strict) {
          throw new TypeError(`Invalid non-integer number: ${value}`)
        }
      // fallthrough
      default:
        return value
    }
  })
}

export function jsonToLex(
  value: JsonValue,
  options: LexParseOptions = { strict: false },
): LexValue {
  switch (typeof value) {
    case 'object': {
      if (value === null) return null
      if (Array.isArray(value)) return jsonArrayToLex(value, options)
      return (
        parseSpecialJsonObject(value, options) ??
        jsonObjectToLexMap(value, options)
      )
    }
    case 'number':
      if (Number.isInteger(value) && Number.isSafeInteger(value)) return value
      if (options.strict) {
        throw new TypeError(`Invalid non-integer number: ${value}`)
      }
    // fallthrough
    case 'boolean':
    case 'string':
      return value
    default:
      throw new TypeError(`Invalid JSON value: ${typeof value}`)
  }
}

function jsonArrayToLex(
  input: JsonValue[],
  options: LexParseOptions,
): LexValue[] {
  // Lazily copy value
  let copy: LexValue[] | undefined
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = jsonToLex(inputItem, options)
    if (item !== inputItem) {
      copy ??= Array.from(input)
      copy[i] = item
    }
  }
  return copy ?? input
}

function jsonObjectToLexMap(
  input: JsonObject,
  options: LexParseOptions,
): LexMap {
  // Lazily copy value
  let copy: LexMap | undefined = undefined
  for (const [key, jsonValue] of Object.entries(input)) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError('Invalid key: __proto__')
    }

    // Ignore (strip) undefined values
    if (jsonValue === undefined) {
      copy ??= { ...input }
      delete copy[key]
      continue
    }

    const value = jsonToLex(jsonValue!, options)
    if (value !== jsonValue) {
      copy ??= { ...input }
      copy[key] = value
    }
  }
  return copy ?? input
}

export function lexToJson(value: LexValue): JsonValue {
  switch (typeof value) {
    case 'object':
      if (value === null) {
        return value
      } else if (Array.isArray(value)) {
        return lexArrayToJson(value)
      } else if (isCid(value)) {
        return encodeLexLink(value)
      } else if (ArrayBuffer.isView(value)) {
        return encodeLexBytes(value)
      } else {
        return encodeLexMap(value)
      }
    case 'boolean':
    case 'string':
    case 'number':
      return value
    default:
      throw new TypeError(`Invalid Lex value: ${typeof value}`)
  }
}

function lexArrayToJson(input: LexArray): JsonValue[] {
  // Lazily copy value
  let copy: JsonValue[] | undefined
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = lexToJson(inputItem)
    if (item !== inputItem) {
      copy ??= Array.from(input) as JsonValue[]
      copy[i] = item
    }
  }
  return copy ?? (input as JsonValue[])
}

function encodeLexMap(input: LexMap): JsonObject {
  // Lazily copy value
  let copy: JsonObject | undefined = undefined
  for (const [key, lexValue] of Object.entries(input)) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError('Invalid key: __proto__')
    }

    // Ignore (strip) undefined values
    if (lexValue === undefined) {
      copy ??= { ...input } as JsonObject
      delete copy[key]
      continue
    }

    const jsonValue = lexToJson(lexValue!)
    if (jsonValue !== lexValue) {
      copy ??= { ...input } as JsonObject
      copy[key] = jsonValue
    }
  }
  return copy ?? (input as JsonObject)
}

function parseSpecialJsonObject(
  input: LexMap,
  options: LexParseOptions,
): Cid | Uint8Array | BlobRef | undefined {
  // Hot path: use hints to avoid parsing when possible

  if (input.$link !== undefined) {
    const cid = parseLexLink(input)
    if (cid) return cid
    if (options.strict) throw new TypeError(`Invalid $link object`)
  } else if (input.$bytes !== undefined) {
    const bytes = parseLexBytes(input)
    if (bytes) return bytes
    if (options.strict) throw new TypeError(`Invalid $bytes object`)
  } else if (input.$type !== undefined) {
    // @NOTE Since blobs are "just" regular lex objects with a special shape,
    // and because an object that does not conform to the blob shape would still
    // result in undefined being returned, we only attempt to parse blobs when
    // the strict option is enabled.
    if (options.strict) {
      if (input.$type === 'blob') {
        const blob = parseBlobRef(input, options)
        if (blob) return blob
        throw new TypeError(`Invalid blob object`)
      } else if (typeof input.$type !== 'string') {
        throw new TypeError(`Invalid $type property (${typeof input.$type})`)
      } else if (input.$type.length === 0) {
        throw new TypeError(`Empty $type property`)
      }
    }
  }

  // @NOTE We ignore legacy blob representation here. They can be handled at the
  // application level if needed.

  return undefined
}
