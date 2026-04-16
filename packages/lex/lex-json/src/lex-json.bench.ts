import { bench, describe } from 'vitest'
import { JsonBytesDecoder } from './json-bytes-decoder.js'
import { JsonValue } from './json.js'
import { jsonToLex } from './lex-json.js'
import { LexParseOptions } from './lex-parse-options.js'
import { lexParse } from './lex-parse.js'
import { parseSpecialJsonObject } from './special-objects.js'

// This benchmark compares the performance of two implementations of
// lexParse:
// - One that uses a reviver function with JSON.parse to directly parse special
//   objects and handle numbers (lexParse with reviver)
// - One that first parses JSON to a plain JS object and then converts it to
//   LexValue using jsonToLex (lexParse with jsonToLex)

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

describe('large payload', () => {
  benchData({
    items: Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      longUnicode:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit 🤩.\n'.repeat(
          2,
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
  benchJson('[{"e":'.repeat(100_000) + '"deep"' + '}]'.repeat(100_000))
})

function benchData(data: unknown, options?: LexParseOptions) {
  return benchJson(JSON.stringify(data), options)
}

function benchJson(jsonString: string, options?: LexParseOptions) {
  const withReviver: typeof lexParse = (input, options = { strict: true }) => {
    return JSON.parse(input, (key: string, value: JsonValue) => {
      switch (typeof value) {
        case 'object':
          if (value === null) return null
          if (Array.isArray(value)) return value
          return parseSpecialJsonObject(value, options) ?? value
        case 'number':
          if (Number.isSafeInteger(value)) return value
          if (options && options.strict === false) return value
          throw new TypeError(`Invalid non-integer number: ${value}`)
        default:
          return value
      }
    })
  }

  const naiveParse: typeof lexParse = (input, options) => {
    return jsonToLex(JSON.parse(input), options) as any
  }

  const lexParseJsonBytesDecoder: typeof lexParse = (jsonString, options) => {
    const bytes = Buffer.from(jsonString, 'utf-8')
    const decoder = new JsonBytesDecoder(bytes, options?.strict)
    return decoder.decode() as any
  }

  bench('current', () => {
    lexParse(jsonString, options)
  })

  bench('with-reviver', () => {
    withReviver(jsonString, options)
  })

  bench('json-bytes-decoder', () => {
    lexParseJsonBytesDecoder(jsonString, options)
  })

  bench('naive', () => {
    naiveParse(jsonString, options)
  })
}
