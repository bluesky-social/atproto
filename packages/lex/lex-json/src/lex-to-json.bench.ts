import { bench, describe } from 'vitest'
import {
  LexArray,
  LexMap,
  LexValue,
  MAX_CBOR_CONTAINER_LEN,
  MAX_CBOR_NESTED_LEVELS,
  MAX_CBOR_OBJECT_KEY_LEN,
  MAX_PAYLOAD_NESTED_LEVELS,
} from '@atproto/lex-data'
import { iterativeTransform } from './iterative-transform.js'
import { jsonToLex } from './json-to-lex.js'
import { JsonObject, JsonValue } from './json.js'
import { LexToJsonOptions, lexToJson } from './lex-to-json.js'
import { validateMaxUtf8Length } from './lib/validate-max-utf8-length.js'
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
  const options = { maxNestedLevels: Infinity, strict: false }

  const lexData = jsonToLex(data, options)

  // Hybrid
  bench(lexToJson, () => {
    lexToJson(lexData, options)
  })

  bench(lexToJsonIterative, () => {
    lexToJsonIterative(lexData, options)
  })

  bench(lexToJsonRecursive, () => {
    lexToJsonRecursive(lexData, options)
  })

  // Useful as baseline but skipped since it is not the same implementation and
  // can be misleading to compare against.
  bench.skip(lexToJsonRecursiveNoCheck, () => {
    lexToJsonRecursiveNoCheck(lexData)
  })
}

export function lexToJsonIterative(
  input: LexValue,
  {
    strict = false,
    allowNonSafeIntegers = !strict,
    maxNestedLevels = strict
      ? MAX_CBOR_NESTED_LEVELS
      : MAX_PAYLOAD_NESTED_LEVELS,
    maxContainerLength = strict ? MAX_CBOR_CONTAINER_LEN : Infinity,
    maxObjectKeyLen = strict ? MAX_CBOR_OBJECT_KEY_LEN : Infinity,
  }: LexToJsonOptions = {},
): JsonValue {
  return iterativeTransform(input, encodeSpecialJsonObject, {
    allowNonSafeIntegers,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
  }) as JsonValue
}

type RecursionContext = Required<LexToJsonOptions> & {
  currentDepth: number
}

function lexToJsonRecursive(
  input: LexValue,
  {
    strict = false,
    allowNonSafeIntegers = !strict,
    maxNestedLevels = strict
      ? MAX_CBOR_NESTED_LEVELS
      : MAX_PAYLOAD_NESTED_LEVELS,
    maxContainerLength = strict ? MAX_CBOR_CONTAINER_LEN : Infinity,
    maxObjectKeyLen = strict ? MAX_CBOR_OBJECT_KEY_LEN : Infinity,
  }: LexToJsonOptions = {},
): JsonValue {
  return lexUnknownToJsonRecursive(input, {
    strict,
    allowNonSafeIntegers,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
    currentDepth: 1,
  })
}

function lexUnknownToJsonRecursive(
  input: LexValue,
  context: RecursionContext,
): JsonValue {
  switch (typeof input) {
    case 'object': {
      if (input === null) {
        return input
      }

      if (context.currentDepth >= context.maxNestedLevels) {
        throw new TypeError(`Input is too deeply nested`)
      }

      if (Array.isArray(input)) {
        return lexArrayToJsonRecursive(input, context)
      } else {
        return (
          encodeSpecialJsonObject(input) ??
          lexMapToJsonRecursive(input as LexMap, context)
        )
      }
    }
    case 'string':
    case 'boolean':
      return input
    case 'number':
      if (context.allowNonSafeIntegers) return input
      if (Number.isSafeInteger(input)) return input
      throw new TypeError(`Invalid non-safe integer: ${input}`)
    default:
      throw new TypeError(`Invalid Lex value: ${typeof input}`)
  }
}

function lexArrayToJsonRecursive(
  input: LexArray,
  context: RecursionContext,
): JsonValue[] {
  // Lazily copy value
  let copy: LexArray | undefined

  if (input.length > context.maxContainerLength) {
    throw new TypeError(`Array is too long (length ${input.length})`)
  }

  context.currentDepth++

  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = lexUnknownToJsonRecursive(inputItem, context)
    if (item !== inputItem) {
      copy ??= [...input]
      copy[i] = item
    }
  }

  context.currentDepth--

  return (copy ?? input) as JsonValue[]
}

function lexMapToJsonRecursive(
  input: LexMap,
  context: RecursionContext,
): JsonObject {
  // Lazily copy value
  let copy: LexMap | undefined = undefined

  const entries = Object.entries(input)

  if (entries.length > context.maxContainerLength) {
    throw new TypeError(
      `Object has too many entries (length ${entries.length})`,
    )
  }

  context.currentDepth++

  for (const [key, lexValue] of entries) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError(`Forbidden "__proto__" key`)
    }

    if (!validateMaxUtf8Length(key, context.maxObjectKeyLen)) {
      const keyStr = `${JSON.stringify(key.slice(0, 10)).slice(0, -1)}\u2026"`
      throw new TypeError(`Object key is too long (${keyStr})`)
    }

    // Ignore (strip) undefined values
    if (lexValue === undefined) {
      copy ??= { ...input }
      delete copy[key]
      continue
    }

    const jsonValue = lexUnknownToJsonRecursive(lexValue!, context)
    if (jsonValue !== lexValue) {
      copy ??= { ...input }
      copy[key] = jsonValue
    }
  }

  context.currentDepth--

  return (copy ?? input) as JsonObject
}

function lexToJsonRecursiveNoCheck(value: LexValue): JsonValue {
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
    const item = lexToJsonRecursiveNoCheck(inputItem)
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

    const jsonValue = lexToJsonRecursiveNoCheck(lexValue!)
    if (jsonValue !== lexValue) {
      copy ??= { ...input } as JsonObject
      copy[key] = jsonValue
    }
  }
  return copy ?? (input as JsonObject)
}
