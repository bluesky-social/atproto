import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import { ui8Concat } from '@atproto/lex-data'
import { type ReadStarOptions, readStar, writeStar } from './star.js'

const collect = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

const readAll = async (bytes: Uint8Array, opts?: ReadStarOptions) => {
  await using reader = await readStar([bytes], opts)
  const pairs = []
  for await (const pair of reader.pairs) pairs.push(pair)
  return { meta: reader.meta, pairs }
}

describe('readStar', () => {
  describe('length limits', () => {
    const meta = { $type: 'test' }
    const pair = { key: Uint8Array.of(1, 2), value: Uint8Array.of(3, 4, 5) }
    const exactLimits = {
      maxMetaLength: encode(meta).length,
      maxKeyLength: pair.key.length,
      maxValueLength: pair.value.length,
    }

    it('accepts lengths up to each limit', async () => {
      const star = await collect(writeStar(meta, [pair]))
      await expect(readAll(star, exactLimits)).resolves.toEqual({
        meta,
        pairs: [pair],
      })
    })

    it.each(Object.entries(exactLimits))(
      'rejects a length over %s',
      async (option, limit) => {
        const star = await collect(writeStar(meta, [pair]))
        const limits = { ...exactLimits, [option]: limit - 1 }
        await expect(readAll(star, limits)).rejects.toThrow(/exceeds limit/)
      },
    )
  })

  it('closes its input when disposed before the pairs are read', async () => {
    const star = await collect(writeStar({ $type: 'test' }, []))
    let closed = false
    async function* input() {
      try {
        yield star
      } finally {
        closed = true
      }
    }

    {
      await using _reader = await readStar(input())
    }
    expect(closed).toBe(true)
  })
})
