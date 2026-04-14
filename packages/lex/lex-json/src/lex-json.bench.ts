import { bench, describe } from 'vitest'
import { JsonValue } from './json.js'
import {
  LexParseOptions,
  jsonToLex,
  lexParse,
  parseSpecialJsonObject,
} from './lex-json.js'

/**
 * This benchmark compares the performance of two implementations of
 * lexParseJsonBytes:
 * 1. lexParseJsonBytesDecoder: An implementation that uses a custom decoder
 *    class that operates directly on bytes to parse JSON and handle AT Protocol
 *    special types.
 * 2. lexParseJsonBytesNaive: A simpler implementation that first decodes bytes
 *    to a UTF-8 string and then uses the existing lexParse function to parse
 *    the JSON.
 */

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

function benchData(data: unknown, options?: LexParseOptions) {
  const jsonString = JSON.stringify(data)

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

  bench('withReviver()', () => {
    withReviver(jsonString, options)
  })

  bench('jsonToLex(JSON.parse())', () => {
    naiveParse(jsonString, options)
  })
}
