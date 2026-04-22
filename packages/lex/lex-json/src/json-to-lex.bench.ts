import { bench, describe } from 'vitest'
import { LexMap, LexValue, utf8Len } from '@atproto/lex-data'
import { iterativeTransform } from './iterative-transform.js'
import { JsonToLexOptions, jsonToLex } from './json-to-lex.js'
import { JsonObject, JsonValue } from './json.js'
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
  type NestedObject = { level: number; nested?: NestedObject }
  const nestedObject: NestedObject = { level: 0 }
  let current: NestedObject = nestedObject
  for (let i = 1; i <= 10_000; i++) {
    current.nested = { level: i }
    current = current.nested
  }

  benchData(nestedObject)
})

function benchData(data: JsonValue) {
  bench(jsonToLex, () => {
    jsonToLex(data, {
      strict: true,
      allowNonSafeIntegers: false,
      maxContainerLength: 1000,
      maxNestedLevels: 10_000,
      maxObjectKeyLen: 100,
    })
  })

  bench(jsonToLexIterative, () => {
    jsonToLexIterative(data, {
      strict: true,
      allowNonSafeIntegers: false,
      maxContainerLength: 1000,
      maxNestedLevels: 10_000,
      maxObjectKeyLen: 100,
    })
  })

  bench(jsonToLexRecursive, () => {
    jsonToLexRecursive(data, {
      strict: true,
      allowNonSafeIntegers: false,
      maxContainerLength: 1000,
      maxNestedLevels: 10_000,
      maxObjectKeyLen: 100,
    })
  })
}

function jsonToLexIterative(
  input: JsonValue,
  options: JsonToLexOptions = {},
): LexValue {
  return iterativeTransform(input, parseSpecialJsonObject, options) as LexValue
}

function jsonToLexRecursive(
  value: JsonValue,
  options?: JsonToLexOptions,
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

function jsonArrayToLex(
  input: JsonValue[],
  options?: JsonToLexOptions,
): LexValue[] {
  // Lazily copy value
  let copy: LexValue[] | undefined

  if (
    options?.maxContainerLength != null &&
    input.length > options.maxContainerLength
  ) {
    throw new TypeError(
      `Array length ${input.length} exceeds maximum of ${options.maxContainerLength}`,
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

function jsonObjectToLexMap(
  input: JsonObject,
  options?: JsonToLexOptions,
): LexMap {
  // Lazily copy value
  let copy: LexMap | undefined = undefined
  const entries = Object.entries(input)

  if (
    options?.maxContainerLength != null &&
    entries.length > options.maxContainerLength
  ) {
    throw new TypeError(
      `Object has ${entries.length} keys, which exceeds maximum of ${options.maxContainerLength}`,
    )
  }

  const maxObjectKeyLen = options?.maxObjectKeyLen

  for (const [key, jsonValue] of entries) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError('Invalid key: __proto__')
    }

    if (maxObjectKeyLen != null) {
      if (
        // Optimized version of "utf8Len(key) > maxObjectKeyLen" that only
        // computes utf8Len if needed.
        key.length * 3 > maxObjectKeyLen &&
        (key.length > maxObjectKeyLen * 3 || utf8Len(key) > maxObjectKeyLen)
      ) {
        const keyStr = `${JSON.stringify(key.slice(0, 10)).slice(0, -1)}\u2026"`
        throw new TypeError(`Object key is too long (${keyStr})`)
      }
    }

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
