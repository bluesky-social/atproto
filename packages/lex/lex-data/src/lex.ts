import { Blob, parseLexBlob } from './blob.js'
import { bytesEquals, encodeLexBytes, parseLexBytes } from './bytes.js'
import { CID, encodeLexLink, isCid, parseLexLink } from './cid.js'
import { Json, JsonObject, JsonScalar } from './json.js'
import { isPlainObject } from './object.js'

export type LexScalar = JsonScalar | CID | Uint8Array
export type Lex = LexScalar | Lex[] | { [_ in string]?: Lex }
export type LexObject = { [_ in string]?: Lex }
export type LexArray = Lex[]

export function lexStringify(input: Lex): string {
  // @NOTE Because of the way the "replacer" works in JSON.stringify, it's
  // simpler to convert Lex to JSON first rather than trying to do it
  // on-the-fly.
  return JSON.stringify(lexToJson(input))
}

export function lexParse(input: string): Lex {
  return JSON.parse(input, lexParseReviver)
}

function lexParseReviver(_key: string, value: Json): Lex {
  switch (typeof value) {
    case 'object':
      if (value === null) return null
      if (Array.isArray(value)) return value
      return parseSpecialJsonObject(value) ?? value
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
      if (Array.isArray(value)) return jsonArrayToLex(value)
      return parseSpecialJsonObject(value) ?? jsonObjectToLex(value)
    }
    case 'number':
      if (Number.isInteger(value)) return value
      throw new TypeError(`Invalid non-integer number: ${value}`)
    case 'boolean':
    case 'string':
      return value
    default:
      throw new TypeError(`Invalid JSON value: ${typeof value}`)
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

function jsonObjectToLex(input: JsonObject): LexObject {
  // Lazily copy value
  let copy: LexObject | undefined = undefined
  for (const [key, inputValue] of Object.entries(input)) {
    const value = jsonToLex(inputValue!)
    if (value !== inputValue) {
      copy ??= { ...input }
      copy[key] = value
    }
  }
  return copy ?? input
}

export function lexToJson(value: Lex): Json {
  switch (typeof value) {
    case 'object':
      if (value === null) {
        return value
      } else if (Array.isArray(value)) {
        return lexArrayToJson(value)
      } else if (isCid(value)) {
        return encodeLexLink(value)
      } else if (value instanceof Uint8Array) {
        return encodeLexBytes(value)
      } else {
        return lexObjectToJson(value)
      }
    case 'boolean':
    case 'string':
    case 'number':
      return value
    default:
      throw new TypeError(`Invalid Lex value: ${typeof value}`)
  }
}

function lexArrayToJson(input: LexArray): Json[] {
  // Lazily copy value
  let copy: Json[] | undefined
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = lexToJson(inputItem)
    if (item !== inputItem) {
      copy ??= Array.from(input) as Json[]
      copy[i] = item
    }
  }
  return copy ?? (input as Json[])
}

function lexObjectToJson(input: LexObject): JsonObject {
  // Lazily copy value
  let copy: JsonObject | undefined = undefined
  for (const [key, inputValue] of Object.entries(input)) {
    const value = lexToJson(inputValue!)
    if (value !== inputValue) {
      copy ??= { ...input } as JsonObject
      copy[key] = value
    }
  }
  return copy ?? (input as JsonObject)
}

function parseSpecialJsonObject(
  input: JsonObject,
): CID | Uint8Array | Blob | undefined {
  // Hot path: use hints to avoid parsing when possible

  if (input.$link !== undefined) {
    return parseLexLink(input)
  } else if (input.$bytes !== undefined) {
    return parseLexBytes(input)
  } else if (input.$type !== undefined) {
    if (input.$type === 'blob') {
      return parseLexBlob(input)
    } else if (!input.$type || typeof input.$type !== 'string') {
      throw new Error(`$type property must be a non-empty string`)
    }
  }

  // @NOTE We ignore legacy blob representation here. They can be handled at the
  // application level if needed.

  return undefined
}

export function lexEquals(a: Lex, b: Lex): boolean {
  if (Object.is(a, b)) {
    return true
  }

  if (
    a == null ||
    b == null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false
    }
    if (a.length !== b.length) {
      return false
    }
    for (let i = 0; i < a.length; i++) {
      if (!lexEquals(a[i], b[i])) {
        return false
      }
    }
    return true
  } else if (Array.isArray(b)) {
    return false
  }

  if (ArrayBuffer.isView(a)) {
    return ArrayBuffer.isView(b) && bytesEquals(a, b)
  } else if (ArrayBuffer.isView(b)) {
    return false
  }

  if (isCid(a)) {
    return CID.asCID(a)!.equals(b)
  } else if (isCid(b)) {
    return false
  }

  if (!isPlainObject(a) || !isPlainObject(b)) {
    // Foolproof (should never happen)
    throw new TypeError('Invalid Lex object value')
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  if (aKeys.length !== bKeys.length) {
    return false
  }

  for (const key of aKeys) {
    const aVal = a[key]
    const bVal = b[key]

    // Needed because of the optional index signature in the Lex object type
    // though, in practice, aVal should never be undefined here.
    if (aVal === undefined) {
      if (bVal === undefined && bKeys.includes(key)) continue
      return false
    } else if (bVal === undefined) {
      return false
    }

    if (!lexEquals(aVal, bVal)) {
      return false
    }
  }

  return true
}
