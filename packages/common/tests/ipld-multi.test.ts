import assert from 'node:assert'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
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
    const [decoded] = cborDecodeMulti(encoded)
    assert(decoded != null)
    assert(typeof decoded === 'object')
    assert('test' in decoded)
    expect(Number.isInteger(decoded['test'])).toBe(true)
  })
})
