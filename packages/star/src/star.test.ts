import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import { ui8Concat } from '@atproto/lex-data'
import { type ReadStarOptions, readStar, writeStar } from './star.js'

const collect = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

const readAll = async (
  input: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  opts?: ReadStarOptions,
) => {
  await using reader = await readStar(input, opts)
  const pairs = []
  for await (const pair of reader.pairs) pairs.push(pair)
  return { meta: reader.meta, pairs }
}

// A single-chunk input that notes when its reader closes it.
function closableInput(bytes: Uint8Array) {
  const input = {
    closed: false,
    async *[Symbol.asyncIterator]() {
      try {
        yield bytes
      } finally {
        input.closed = true
      }
    },
  }
  return input
}

const meta = { $type: 'test' }
const pair = { key: Uint8Array.of(1, 2), value: Uint8Array.of(3, 4, 5) }
const star = await collect(writeStar(meta, [pair]))

describe(readStar, () => {
  describe('length limits', () => {
    const exactLimits = {
      maxMetaLength: encode(meta).length,
      maxKeyLength: pair.key.length,
      maxValueLength: pair.value.length,
    }

    it('accepts lengths up to each limit', async () => {
      await expect(readAll([star], exactLimits)).resolves.toEqual({
        meta,
        pairs: [pair],
      })
    })

    it.each(Object.entries(exactLimits))(
      'rejects a length over %s',
      async (option, limit) => {
        const limits = { ...exactLimits, [option]: limit - 1 }
        await expect(readAll([star], limits)).rejects.toThrow(
          `length ${limit} exceeds limit of ${limit - 1}`,
        )
      },
    )
  })

  describe('closing its input', () => {
    it('closes it when disposed before the pairs are read', async () => {
      const input = closableInput(star)
      {
        await using _reader = await readStar(input)
      }
      expect(input.closed).toBe(true)
    })

    it('closes it when the header fails to parse', async () => {
      const input = closableInput(star)
      await expect(readStar(input, { maxMetaLength: 1 })).rejects.toThrow(
        /exceeds limit/,
      )
      expect(input.closed).toBe(true)
    })

    it('closes it when a pair fails to parse', async () => {
      const input = closableInput(star)
      const reader = await readStar(input, { maxValueLength: 1 })
      await expect(reader.pairs.next()).rejects.toThrow(/exceeds limit/)
      expect(input.closed).toBe(true)
    })
  })
})
