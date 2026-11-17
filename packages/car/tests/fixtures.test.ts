import { describe, expect, test } from 'vitest'
import {
  fromBase64,
  parseCid,
  toBase64,
  ui8ConcatAsync,
} from '@atproto/lex-data'
import { BlockMap, readCarStream, writeCarStream } from '../src/index.js'
import fixtures from './car-file-fixtures.json' with { type: 'json' }

describe('car fixtures', () => {
  test.each(fixtures)('reads $root', async (fixture) => {
    await using reader = await readCarStream([fromBase64(fixture.car)])
    expect(reader.roots.map(String)).toEqual([fixture.root])
    const blocks = Array.from(await BlockMap.from(reader), (block) => ({
      cid: block.cid.toString(),
      bytes: toBase64(block.bytes, 'base64'),
    }))
    expect(blocks).toEqual(fixture.blocks)
  })

  test.each(fixtures)('writes $root', async (fixture) => {
    const blocks = fixture.blocks.map((block) => ({
      cid: parseCid(block.cid),
      bytes: fromBase64(block.bytes),
    }))
    const car = await ui8ConcatAsync(
      writeCarStream(parseCid(fixture.root), blocks),
    )
    // The fixture's base64 is unpadded.
    expect(toBase64(car)).toEqual(fixture.car)
  })
})
