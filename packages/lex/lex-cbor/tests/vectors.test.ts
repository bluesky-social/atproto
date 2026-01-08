import { describe, expect, it } from 'vitest'
import { lexEquals } from '@atproto/lex-data'
import { jsonToLex, lexToJson } from '@atproto/lex-json'
import { cidForLex, decode, encode } from '../src/index.js'
import { vectors } from './vectors.js'

describe('lex', () => {
  for (const vector of vectors) {
    it(`passes test vector: ${vector.name}`, async () => {
      const lex = jsonToLex(vector.json)
      const json = lexToJson(lex)
      const cbor = encode(lex)
      const ipldAgain = decode(cbor)
      const jsonAgain = lexToJson(ipldAgain)
      const cid = await cidForLex(lex)
      expect(json).toEqual(vector.json)
      expect(jsonAgain).toEqual(vector.json)
      expect(lexEquals(lex, vector.lex)).toBeTruthy()
      expect(lexEquals(ipldAgain, vector.lex)).toBeTruthy()
      expect(Buffer.compare(cbor, vector.cbor)).toBe(0)
      expect(cid.toString()).toEqual(vector.cid)
    })
  }
})
