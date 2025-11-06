import { jsonToLex, lexEquals, lexToJson } from '@atproto/lex-data'
import { cborDecode, cborEncode, cidForCbor } from '..'
import { vectors } from './vectors'

describe('lex', () => {
  for (const vector of vectors) {
    it(`passes test vector: ${vector.name}`, async () => {
      const lex = jsonToLex(vector.json)
      const json = lexToJson(lex)
      const cbor = cborEncode(lex)
      const ipldAgain = cborDecode(cbor)
      const jsonAgain = lexToJson(ipldAgain)
      const cid = await cidForCbor(lex)
      expect(json).toEqual(vector.json)
      expect(jsonAgain).toEqual(vector.json)
      expect(lexEquals(lex, vector.lex)).toBeTruthy()
      expect(lexEquals(ipldAgain, vector.lex)).toBeTruthy()
      expect(Buffer.compare(cbor, vector.cbor)).toBe(0)
      expect(cid.toString()).toEqual(vector.cid)
    })
  }
})
