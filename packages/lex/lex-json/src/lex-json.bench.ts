import { bench, describe } from 'vitest'
import { utf8FromBytes } from '@atproto/lex-data'
import { lexParseJsonBytes, lexParse, LexParseOptions } from './lex-json.js'

/**
 * Naive implementation (baseline)
 */
const lexParseJsonBytesNaive: typeof lexParseJsonBytes = (
  jsonBytes,
  options,
) => {
  const jsonString = utf8FromBytes(jsonBytes)
  return lexParse(jsonString, options)
}

function benchData(data: unknown, options?: LexParseOptions) {
  const jsonBytes = Buffer.from(JSON.stringify(data))

  bench(lexParseJsonBytes, () => {
    lexParseJsonBytes(jsonBytes, options)
  })

  bench(lexParseJsonBytesNaive, () => {
    lexParseJsonBytesNaive(jsonBytes, options)
  })
}

describe('integer', () => {
  describe('base', () => {
    benchData(42)
  })
})

describe('string', () => {
  describe('ascii', () => {
    describe('short', () => {
      benchData('hello world')
    })

    describe('long', () => {
      benchData(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n'.repeat(
          100,
        ),
      )
    })
  })

  describe('unicode', () => {
    describe('short', () => {
      benchData('Hello 世界! 🌍🌎🌏 Ñoño')
    })

    describe('long', () => {
      benchData('a世界'.repeat(10000))
    })
  })

  describe('Long text with unicode and escaped characters', () => {
    benchData(
      [
        'Lorém ipsum dolor sit amet, consectetur adipiscing elit 🤩.',
        'Sed ço eiusmod tempor 🇧🇪 incididunt ut labore et dolore magna aliqua.',
        '',
        '\tUt enim ° minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        '\tDuis aute @ dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
        '',
        'Excepteur sint õ cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      ].join('\n'),
    )
  })
})

describe('object', () => {
  describe('small', () => {
    benchData({
      string: 'hello world',
      number: 42,
      bool: true,
      null: null,
    })
  })

  describe('medium', () => {
    benchData({
      user: {
        id: '12345',
        name: 'John Doe',
        email: 'john@example.com',
        active: true,
        score: 95,
      },
      posts: [
        { id: 1, title: 'First Post', likes: 10 },
        { id: 2, title: 'Second Post', likes: 25 },
        { id: 3, title: 'Third Post', likes: 42 },
      ],
      metadata: {
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-15T12:30:00Z',
      },
    })
  })

  describe('large', () => {
    benchData({
      records: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        cid: {
          $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        },
        text: `This is record number ${i} with some text content that makes it more realistic`,
        metadata: {
          timestamp: Date.now(),
          user: `user_${i}`,
          tags: ['tag1', 'tag2', 'tag3'],
        },
      })),
    })
  })

  describe('heavy nesting', () => {
    type NestedObject = { level: number; nested?: NestedObject }
    const nestedObject = { level: 0 }
    let current: NestedObject = nestedObject
    for (let i = 1; i <= 100; i++) {
      current.nested = { level: i }
      current = current.nested
    }

    benchData(nestedObject)
  })

  describe('lex-data', () => {
    describe('$link', () => {
      describe('base', () => {
        benchData({
          $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        })
      })
    })

    describe('$bytes', () => {
      const alphabet =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

      for (const length of [32, 128, 256, 512, 1024, 1024 * 1024]) {
        describe(String(length), () => {
          benchData({
            $bytes: Array.from(
              { length },
              (_, i) => alphabet[i % alphabet.length],
            ).join(''),
          })
        })
      }
    })

    describe('mixed', () => {
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
            $link:
              'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
          },
          mimeType: 'image/jpeg',
          size: 10000,
        },
        nested: {
          array: [
            {
              $link:
                'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
            },
            {
              $bytes: 'iE+sPoHobU9tSIqGI+309LLCcWQIRmEXwxcoDt19tas',
            },
          ],
        },
      })
    })
  })
})

describe('array', () => {
  describe('small', () => {
    benchData([1, 'two', true, null])
  })

  describe('medium', () => {
    benchData(
      Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: `Item ${i}`,
        active: i % 2 === 0,
      })),
    )
  })

  describe('number heavy', () => {
    benchData([
      0,
      1,
      -1,
      42,
      -100,
      9007199254740991,
      42,
      -1000,
      9007199254740991,
      Date.now(),
      ...Array.from({ length: 100 }, (_, i) =>
        Math.floor(i * 1000 * Math.random()),
      ),
    ])
  })

  describe('many short strings (key & value)', () => {
    benchData(
      Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`key${i}`, `value${i}`]),
      ),
    )
  })

  describe('many medium strings', () => {
    benchData(Array.from({ length: 100 }, (_, i) => 'x'.repeat(i)))
  })

  describe('many small objects', () => {
    benchData(
      Array.from({ length: 200 }, (_, i) => ({
        id: i,
        name: `item${i}`,
        active: true,
      })),
    )
  })

  describe('many empty objects', () => {
    benchData(Array.from({ length: 200 }, () => ({})))
  })

  describe('many small arrays', () => {
    benchData(Array.from({ length: 200 }, (_, i) => [i, '', true]))
  })

  describe('many empty arrays', () => {
    benchData(Array.from({ length: 200 }, () => []))
  })
})

describe('complex nested structure', () => {
  // Similar to the large object benchmark but smaller
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
