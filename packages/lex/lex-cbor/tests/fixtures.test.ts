import { jsonToLex, lexToJson } from '@atproto/lex-data'
import { cborDecodeAll, cborEncode, cidForCbor } from '..'
import fixtures from './fixtures.json' with { type: 'json' }

describe('fixtures', () => {
  for (const fixture of fixtures) {
    it(fixture.cid, async () => {
      const lex = jsonToLex(fixture.json)
      const cid = await cidForCbor(lex)
      expect(cid.toString()).toEqual(fixture.cid)
      const encoded = cborEncode(lex)
      expect(encoded).toBeInstanceOf(Uint8Array)
      // @NOTE cborEncode() returns Buffer instances on NodeJS (which is a subclass of Uint8Array)
      expect(encoded).toEqual(Buffer.from(fixture.cbor_base64, 'base64'))
      const [decoded, ...rest] = cborDecodeAll(encoded)
      expect(rest.length).toBe(0)
      expect(lexToJson(decoded)).toEqual(fixture.json)
    })
  }
})
