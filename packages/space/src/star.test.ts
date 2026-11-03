import { describe, expect, it } from 'vitest'
import { encodeVarInt } from '@atproto/car'
import { encode } from '@atproto/lex-cbor'
import { ui8Concat } from '@atproto/lex-data'
import { StarParseError } from './error.js'
import { STAR_MAGIC, readStar, writeStar } from './star.js'

const collect = async (
  stream: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

const readAll = async (bytes: Uint8Array) => {
  await using reader = await readStar([bytes])
  const pairs = []
  for await (const pair of reader.pairs) pairs.push(pair)
  return { meta: reader.meta, pairs }
}

const header = (meta: Uint8Array) =>
  Buffer.concat([STAR_MAGIC, encodeVarInt(meta.length), meta])

describe('STAR', () => {
  it('round-trips metadata and pairs', async () => {
    const pairs = [
      { key: Uint8Array.of(1), value: Uint8Array.of(2, 3) },
      { key: new Uint8Array(), value: new Uint8Array() },
    ]
    const bytes = await collect(writeStar({ $type: 'test', n: 1 }, pairs))
    expect(bytes.subarray(0, 4)).toEqual(Uint8Array.of(0x2a, 0x6c, 0x01, 0x00))

    const read = await readAll(bytes)
    expect(read.meta).toEqual({ $type: 'test', n: 1 })
    expect(read.pairs).toEqual(pairs)
  })

  it('precedes each pair with a 0x01 byte and ends with a 0x00 byte', async () => {
    const meta = { $type: 'test' }
    const pairs = [{ key: Uint8Array.of(7), value: Uint8Array.of(8, 9) }]
    const bytes = await collect(writeStar(meta, pairs))
    expect(bytes).toEqual(
      ui8Concat([
        header(encode(meta)),
        Uint8Array.of(0x01, 1, 7, 2, 8, 9),
        Uint8Array.of(0x00),
      ]),
    )
  })

  it('rejects the wrong magic bytes', async () => {
    const bytes = await collect(writeStar({ $type: 'test' }, []))
    bytes[0] = 0x3a
    await expect(readAll(bytes)).rejects.toThrow(/invalid magic bytes/)
  })

  it('rejects a non-canonical varint', async () => {
    const meta = encode({ $type: 'test' })
    // The length, padded with a superfluous zero byte.
    const bytes = Buffer.concat([
      STAR_MAGIC,
      Uint8Array.of(meta.length | 0x80, 0x00),
      meta,
    ])
    await expect(readAll(bytes)).rejects.toThrow(/non-canonical varint/)
  })

  it('rejects non-canonical metadata', async () => {
    // {"$type":"t","a":1} with its keys out of canonical (length-first) order.
    const meta = Uint8Array.of(
      0xa2,
      ...[0x65, ...Buffer.from('$type'), 0x61, 0x74],
      ...[0x61, 0x61, 0x01],
    )
    await expect(readAll(header(meta))).rejects.toThrow(/not canonical/)
  })

  it('rejects metadata without a $type', async () => {
    await expect(readAll(header(encode({ a: 1 })))).rejects.toThrow(
      /must be a map with a \$type/,
    )
  })

  it('rejects trailing bytes after the metadata item', async () => {
    const meta = Buffer.concat([encode({ $type: 'test' }), Uint8Array.of(0)])
    await expect(readAll(header(meta))).rejects.toThrow(/invalid metadata/)
  })

  it('rejects EOF inside a pair', async () => {
    const bytes = Buffer.concat([
      header(encode({ $type: 'test' })),
      Uint8Array.of(0x01),
      encodeVarInt(1),
      Uint8Array.of(1),
      // missing value
    ])
    await expect(readAll(bytes)).rejects.toThrow(StarParseError)
  })

  it('rejects an archive without its end byte', async () => {
    const bytes = header(encode({ $type: 'test' }))
    await expect(readAll(bytes)).rejects.toThrow(/unexpected end of archive/)
  })

  it('rejects an unknown control byte', async () => {
    const bytes = Buffer.concat([
      header(encode({ $type: 'test' })),
      Uint8Array.of(0x02),
    ])
    await expect(readAll(bytes)).rejects.toThrow(/invalid control byte/)
  })

  it('rejects bytes after the end byte', async () => {
    const bytes = Buffer.concat([
      await collect(writeStar({ $type: 'test' }, [])),
      Uint8Array.of(0x00),
    ])
    await expect(readAll(bytes)).rejects.toThrow(/after end of archive/)
  })
})
