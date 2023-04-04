import * as ui8 from 'uint8arrays'
import vectors from './ipld-vectors'
import {
  cborDecode,
  cborEncode,
  cidForCbor,
  ipldEquals,
  ipldToJson,
  jsonToIpld,
} from '../src'

describe('ipld', () => {
  for (const vector of vectors) {
    it(`passes test vector: ${vector.name}`, async () => {
      const ipld = jsonToIpld(vector.json)
      const json = ipldToJson(ipld)
      const cbor = cborEncode(ipld)
      const ipldAgain = cborDecode(cbor)
      const jsonAgain = ipldToJson(ipldAgain)
      const cid = await cidForCbor(ipld)
      expect(json).toEqual(vector.json)
      expect(jsonAgain).toEqual(vector.json)
      expect(ipldEquals(ipld, vector.ipld)).toBeTruthy()
      expect(ipldEquals(ipldAgain, vector.ipld)).toBeTruthy()
      expect(ui8.equals(cbor, vector.cbor)).toBeTruthy()
      expect(cid.toString()).toEqual(vector.cid)
    })
  }
})
