import * as ui8 from 'uint8arrays'
import { CID } from '@atproto/lex-data'
import { cborDecodeMulti, cborEncode } from '../src'

describe('ipld decode multi', () => {
  it('decodes concatenated dag-cbor messages', async () => {
    const one = {
      a: 123,
      b: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const two = {
      c: new Uint8Array([1, 2, 3]),
      d: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const encoded = ui8.concat([cborEncode(one), cborEncode(two)])
    const decoded = cborDecodeMulti(encoded)
    expect(decoded.length).toBe(2)
    expect(decoded[0]).toEqual(one)
    expect(decoded[1]).toEqual(two)
  })

  it('parses safe ints as number', async () => {
    const one = {
      test: Number.MAX_SAFE_INTEGER,
    }
    const encoded = cborEncode(one)
    const decoded = cborDecodeMulti(encoded)
    expect(Number.isInteger(decoded[0]?.['test'])).toBe(true)
  })
})
