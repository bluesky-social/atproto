import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { ipldToJson, jsonToIpld } from '../src'

describe('ipld', () => {
  it('converts ipld to json', () => {
    const ipld = {
      one: 1,
      two: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
      three: new Uint8Array([0, 1, 2, 3]),
    }
    const json = ipldToJson(ipld)
    expect(json).toEqual({
      one: 1,
      two: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      three: {
        $bytes: 'AAECAw',
      },
    })
  })

  it('converts json to ipld', () => {
    const json = {
      one: 1,
      two: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      three: {
        $bytes: 'AAECAw',
      },
    }
    const expectedCid = CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )

    const ipld = jsonToIpld(json)
    if (!ipld) {
      throw new Error()
    }
    expect(ipld['one']).toBe(1)
    expect(expectedCid.equals(ipld['two'])).toBeTruthy()
    expect(ui8.equals(ipld['three'], new Uint8Array([0, 1, 2, 3]))).toBeTruthy()
  })

  it('converts nested ipld to json', () => {
    const ipld = {
      a: {
        b: [
          CID.parse(
            'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
          ),
        ],
      },
    }
    const json = ipldToJson(ipld)
    expect(json).toEqual({
      a: {
        b: [
          {
            $link:
              'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
          },
        ],
      },
    })
  })

  it('converts nested json to ipld', () => {
    const json = {
      a: {
        b: [
          {
            $link:
              'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
          },
        ],
      },
    }
    const ipld = jsonToIpld(json)
    const expectedCid = CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    expect(ipld && expectedCid.equals(ipld['a']['b']))
  })
})
