import { Blob, parseLexBlob } from './blob.js'
import { encodeLexBytes, parseLexBytes } from './bytes.js'
import { CID, isCid } from './cid.js'
import { Json, JsonObject, JsonScalar } from './json.js'
import { encodeLexLink, parseLexLink } from './link.js'
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

export type LexParseOptions = {
  /**
   * Forbids the presence of invalid Lex values (e.g. non-integer numbers,
   * malformed $link, $bytes, blob objects, etc.)
   */
  strict?: boolean
}

export function lexParse(
  input: string,
  options: LexParseOptions = { strict: false },
): Lex {
  return JSON.parse(input, function (key: string, value: Json): Lex {
    switch (typeof value) {
      case 'object':
        if (value === null) return null
        if (Array.isArray(value)) return value
        return parseSpecialJsonObject(value, options) ?? value
      case 'number':
        if (Number.isInteger(value)) return value
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
  value: Json,
  options: LexParseOptions = { strict: false },
): Lex {
  switch (typeof value) {
    case 'object': {
      if (value === null) return null
      if (Array.isArray(value)) return jsonArrayToLex(value, options)
      return (
        parseSpecialJsonObject(value, options) ??
        jsonObjectToLex(value, options)
      )
    }
    case 'number':
      if (Number.isInteger(value)) return value
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

function jsonArrayToLex(input: Json[], options: LexParseOptions): Lex[] {
  // Lazily copy value
  let copy: Lex[] | undefined
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

function jsonObjectToLex(
  input: JsonObject,
  options: LexParseOptions,
): LexObject {
  // Lazily copy value
  let copy: LexObject | undefined = undefined
  for (const [key, inputValue] of Object.entries(input)) {
    const value = jsonToLex(inputValue!, options)
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
  options: LexParseOptions,
): CID | Uint8Array | Blob | undefined {
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
        const blob = parseLexBlob(input)
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
    if (!ArrayBuffer.isView(b)) return false

    if (a.byteLength !== b.byteLength) {
      return false
    }

    for (let i = 0; i < a.byteLength; i++) {
      if (a[i] !== b[i]) {
        return false
      }
    }

    return true
  } else if (ArrayBuffer.isView(b)) {
    return false
  }

  if (isCid(a)) {
    return CID.asCID(a)!.equals(CID.asCID(b)) === true
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
