import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { cborEncode, cborDecodeMulti } from '../src'

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
})
