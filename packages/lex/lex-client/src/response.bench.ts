import { bench, describe } from 'vitest'
import {
  LexParseOptions,
  jsonToLex,
  lexParse,
  lexParseJsonBytes,
} from '@atproto/lex-json'

// This benchmark compares the performance of three approaches to parsing JSON
// responses in the Lex client:
// 1. lexParse(await response.text()): The current approach used in the client,
//    which reads the response as text and then parses it with lexParse.
// 2. jsonToLex(await response.json()): An approach that first parses the
//    response as JSON to a plain JS object and then converts it to LexValue
//    using jsonToLex.
// 3. lexParseJsonBytes(await response.bytes()): An approach that reads the
//    response as bytes and uses a custom function that first decodes bytes to
//    string and then parses JSON with lexParse.

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
