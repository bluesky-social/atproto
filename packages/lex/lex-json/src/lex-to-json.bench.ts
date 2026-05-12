import { bench, describe } from 'vitest'
import { LexArray, LexMap, LexValue } from '@atproto/lex-data'
import { jsonToLex } from './json-to-lex.js'
import { JsonObject, JsonValue } from './json.js'
import { lexToJson } from './lex-to-json.js'
import { encodeSpecialJsonObject } from './special-objects.js'

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

  // Wrap the value in nested objects to create a deep structure to show it
  // fails in the recursive implementation but not in the iterative one.
  for (let i = 1; i <= 50_000; i++) {
    current = { nested: current, level: i }

    if (i === 10_000) {
      current.bytes = { $bytes: 'dGVzdA==' }
    }
  }

  benchData(current)
})

/**
 * Benchmarks the performance of the `lexToJson` function against a pure
 * recursive implementation (that does not perform depth checks).
 */
function benchData(data: JsonValue) {
  const options = { maxNestedLevels: Infinity, strict: false }

  const lexData = jsonToLex(data, options)

  bench(lexToJson, () => {
    lexToJson(lexData, options)
  })

  bench(lexToJsonRecursive, () => {
    lexToJsonRecursive(lexData)
  })
}

function lexToJsonRecursive(value: LexValue): JsonValue {
  switch (typeof value) {
    case 'object':
      if (value === null) {
        return value
      } else if (Array.isArray(value)) {
        return lexArrayToJsonNoCheck(value)
      } else {
        return (
          encodeSpecialJsonObject(value) ?? encodeLexMapNoCheck(value as LexMap)
        )
      }
    case 'boolean':
    case 'string':
    case 'number':
      return value
    default:
      throw new TypeError(`Invalid Lex value: ${typeof value}`)
  }
}

function lexArrayToJsonNoCheck(input: LexArray): JsonValue[] {
  // Lazily copy value
  let copy: JsonValue[] | undefined
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = lexToJsonRecursive(inputItem)
    if (item !== inputItem) {
      copy ??= Array.from(input) as JsonValue[]
      copy[i] = item
    }
  }
  return copy ?? (input as JsonValue[])
}

function encodeLexMapNoCheck(input: LexMap): JsonObject {
  // Lazily copy value
  let copy: JsonObject | undefined = undefined
  for (const key in input) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError('Invalid key: __proto__')
    }

    // Ignore (strip) undefined values
    const lexValue = input[key]
    if (lexValue === undefined) {
      copy ??= { ...input } as JsonObject
      delete copy[key]
      continue
    }

    const jsonValue = lexToJsonRecursive(lexValue!)
    if (jsonValue !== lexValue) {
      copy ??= { ...input } as JsonObject
      copy[key] = jsonValue
    }
  }
  return copy ?? (input as JsonObject)
}
