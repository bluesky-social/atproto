import { describe, expect, it } from 'vitest'
import { ui8Equals } from '@atproto/lex-data'
import { jsonToLex, lexToJson } from '@atproto/lex-json'
import { cidForLex, decodeAll, encode } from '../src/index.js'
import fixtures from './data-model-fixtures.json' with { type: 'json' }

describe('fixtures', () => {
  for (const fixture of fixtures) {
    it(fixture.cid, async () => {
      const lex = jsonToLex(fixture.json, { strict: true })
      const cid = await cidForLex(lex)
      expect(cid.toString()).toBe(fixture.cid)
      const encoded = encode(lex)
      expect(encoded).toBeInstanceOf(Uint8Array)
      expect(
        ui8Equals(encoded, Buffer.from(fixture.cbor_base64, 'base64')),
      ).toBe(true)
      const [decoded, ...rest] = decodeAll(encoded)
      expect(rest.length).toBe(0)
      expect(lexToJson(decoded)).toEqual(fixture.json)
    })
  }
})
