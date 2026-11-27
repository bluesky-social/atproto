import { describe, expect, it } from 'vitest'
import { ui8Concat } from '@atproto/lex-data'
import {
  type StarMeta,
  StarParseError,
  readStar,
  writeStar,
} from '../src/index.js'
import invalidFixtures from './interop/invalid-star-fixtures.json' with { type: 'json' }
import validFixtures from './interop/valid-star-fixtures.json' with { type: 'json' }

const fromHex = (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'))

const collect = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

const readAll = async (chunks: Uint8Array[]) => {
  await using reader = await readStar(chunks)
  const pairs = []
  for await (const pair of reader.pairs) pairs.push(pair)
  return { meta: reader.meta, pairs }
}

// Every archive is read both whole and one byte at a time, to exercise reads
// that span chunks.
const chunkings = [
  ['whole', (bytes: Uint8Array) => [bytes]],
  [
    'byte by byte',
    (bytes: Uint8Array) => Array.from(bytes, (byte) => Uint8Array.of(byte)),
  ],
] as const

describe.each(validFixtures)('valid: $comment', (fixture) => {
  const star = fromHex(fixture.star_hex)
  const meta = fixture.decoded.meta as StarMeta
  const pairs = fixture.decoded.pairs.map((pair) => ({
    key: fromHex(pair.key_hex),
    value: fromHex(pair.value_hex),
  }))

  it.each(chunkings)('reads %s', async (_, chunk) => {
    expect(await readAll(chunk(star))).toEqual({ meta, pairs })
  })

  it('writes the same bytes', async () => {
    expect(await collect(writeStar(meta, pairs))).toEqual(star)
  })
})

describe.each(invalidFixtures)('invalid: $comment', (fixture) => {
  const star = fromHex(fixture.star_hex)

  it.each(chunkings)('rejects %s', async (_, chunk) => {
    await expect(readAll(chunk(star))).rejects.toThrow(StarParseError)
  })
})
