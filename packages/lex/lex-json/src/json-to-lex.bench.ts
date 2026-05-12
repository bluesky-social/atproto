import { bench, describe } from 'vitest'
import { LexMap, LexValue } from '@atproto/lex-data'
import { JsonToLexOptions, jsonToLex } from './json-to-lex.js'
import { JsonObject, JsonValue } from './json.js'
import { validateMaxUtf8Length } from './lib/validate-max-utf8-length.js'
import { parseSpecialJsonObject } from './special-objects.js'

// This benchmark compares the performance of two implementations of
// lexParseJsonBytes:
// 1. lexParseJsonBytesDecoder: An implementation that uses a custom decoder
//    class that operates directly on bytes to parse JSON and handle AT Protocol
//    special types.
// 2. lexParseJsonBytesNaive: A simpler implementation that first decodes bytes
//    to a UTF-8 string and then uses the existing lexParse function to parse
//    the JSON.

describe('small object', () => {
  benchData({
    $type: 'app.bsky.feed.post',
    text: 'Hello world! 👋',
    createdAt: '2024-01-01T00:00:00Z',
  })
})

describe('simple mixed structure', () => {
  benchData({
    cid: {
      $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    },
    bytes: {
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
    },
    blob: {
      $type: 'blob',
      ref: {
        $link: 'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
      },
      mimeType: 'image/jpeg',
      size: 10000,
    },
    nested: {
      array: [
        {
          number: 42,
          string: 'hello world',
          bool: true,
          null: null,
        },
      ],
      string: 'Hello 世界! 🌍🌎🌏 Ñoño',
      createdAt: '2024-01-01T00:00:00Z',
    },
  })
})

describe('large structure', () => {
  // Similar to the large object benchmark but smaller
  benchData({
    items: Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      longUnicode:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit 🤩.\n'.repeat(
          3,
        ),
      tags: ['tag1', 'tag2', 'tag3'],
      bytes: {
        $bytes: Buffer.from(`This is some byte data for item ${i}`).toString(
          'base64',
        ),
      },
      cid: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      metadata: {
        created: '2024-01-01T00:00:00Z',
        count: i * 10,
        nested: {
          flag: i % 2 === 0,
          values: [i, i * 2, i * 3],
        },
        items: Array.from({ length: 5 }, (_, j) => ({
          id: `${i}-${j}`,
          value: `Value ${i}-${j}`,
        })),
      },
    })),
  })
})

describe('deeply nested structure', () => {
  let current: JsonValue = { level: 0 }

  // Then deeply wrap the value in nested objects to create a deep structure to
  // show it fails in the recursive implementation but not in the iterative one.
  for (let i = 1; i <= 50_000; i++) {
    current = { level: i, nested: current }

    if (i === 10_000) {
      current.bytes = { $bytes: 'dGVzdA==' }
    }
  }

  benchData(current)
})

/**
 * Benchmarks the performance of the `jsonToLex` function against a pure
 * recursive implementation (that does not perform depth checks).
 */
function benchData(data: JsonValue) {
  const options = {
    strict: true,
    allowNonSafeIntegers: false,
    maxContainerLength: 1000,
    maxNestedLevels: 10_000,
    maxObjectKeyLen: 100,
  }

  bench(jsonToLex, () => {
    jsonToLex(data, options)
  })

  bench(jsonToLexRecursive, () => {
    jsonToLexRecursive(data, options)
  })
}

function jsonToLexRecursive(
  value: JsonValue,
  options?: JsonToLexOptions,
): LexValue {
  switch (typeof value) {
    case 'object': {
      if (value === null) return null
      if (Array.isArray(value))
        return jsonArrayToLexNoDepthCheck(value, options)
      return (
        parseSpecialJsonObject(value, options) ??
        jsonObjectToLexMapNoCheck(value, options)
      )
    }
    case 'number':
      if (Number.isSafeInteger(value)) return value
      if (options?.allowNonSafeIntegers !== false) return value
      throw new TypeError(`Invalid non-integer number: ${value}`)
    case 'boolean':
    case 'string':
      return value
    default:
      throw new TypeError(`Invalid JSON value: ${typeof value}`)
  }
}

function jsonArrayToLexNoDepthCheck(
  input: JsonValue[],
  options?: JsonToLexOptions,
): LexValue[] {
  // Lazily copy value
  let copy: LexValue[] | undefined

  const maxContainerLength = options?.maxContainerLength
  if (maxContainerLength != null && input.length > maxContainerLength) {
    throw new TypeError(
      `Array length ${input.length} exceeds maximum of ${maxContainerLength}`,
    )
  }

  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = jsonToLexRecursive(inputItem, options)
    if (item !== inputItem) {
      copy ??= Array.from(input)
      copy[i] = item
    }
  }
  return copy ?? input
}

function jsonObjectToLexMapNoCheck(
  input: JsonObject,
  options?: JsonToLexOptions,
): LexMap {
  // Lazily copy value
  let copy: LexMap | undefined = undefined

  const maxObjectKeyLen = options?.maxObjectKeyLen
  const maxContainerLength = options?.maxContainerLength

  let count = 0

  for (const key in input) {
    count++

    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError('Invalid key: __proto__')
    }

    if (maxContainerLength != null && count > maxContainerLength) {
      throw new TypeError(`Object has too many entries`)
    }

    if (maxObjectKeyLen != null) {
      if (!validateMaxUtf8Length(key, maxObjectKeyLen)) {
        const keyStr = `${JSON.stringify(key.slice(0, 10)).slice(0, -1)}\u2026"`
        throw new TypeError(`Object key is too long (${keyStr})`)
      }
    }

    const jsonValue = input[key]

    // Ignore (strip) undefined values
    if (jsonValue === undefined) {
      copy ??= { ...input }
      delete copy[key]
      continue
    }

    const value = jsonToLexRecursive(jsonValue!, options)
    if (value !== jsonValue) {
      copy ??= { ...input }
      copy[key] = value
    }
  }
  return copy ?? input
}
