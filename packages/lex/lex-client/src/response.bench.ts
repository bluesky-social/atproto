import { bench, describe } from 'vitest'
import {
  LexParseOptions,
  jsonToLex,
  lexParse,
  lexParseJsonBytes,
} from '@atproto/lex-json'

describe('Response parsing', () => {
  function benchData(data: unknown, options?: LexParseOptions) {
    const body = Buffer.from(JSON.stringify(data))
    const init = {
      headers: { 'Content-Type': 'application/json' },
    }

    bench('lexParse(await response.text())', async () => {
      const response = new Response(body, init)
      lexParse(await response.text(), options)
    })

    bench('jsonToLex(await response.json())', async () => {
      const response = new Response(body, init)
      jsonToLex(await response.json(), options)
    })

    bench('lexParseJsonBytes(await response.bytes())', async () => {
      const response = new Response(body, init)
      lexParseJsonBytes(await response.bytes(), options)
    })
  }

  describe('small payload', () => {
    benchData({
      $type: 'app.bsky.feed.post',
      text: 'Hello world! 👋',
      createdAt: '2024-01-01T00:00:00Z',
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
})
