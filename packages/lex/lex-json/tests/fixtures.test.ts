import { describe, expect, it } from 'vitest'
import { isPlainObject } from '@atproto/lex-data'
import { JsonValue, jsonToLex } from '../src/index.js'
import invalidFixtures from './data-model-invalid.json' with { type: 'json' }
import validFixtures from './data-model-valid.json' with { type: 'json' }

function parseLexFixture(input: JsonValue) {
  const lex = jsonToLex(input, { strict: true })
  if (!isPlainObject(lex)) {
    throw new Error('Expected a plain object')
  }
}

describe('invalidFixtures', () => {
  for (const fixture of invalidFixtures) {
    it(fixture.note, async () => {
      expect(() => parseLexFixture(fixture.json)).toThrow()
    })
  }
})

describe('validFixtures', () => {
  for (const fixture of validFixtures) {
    it(fixture.note, () => {
      expect(() => parseLexFixture(fixture.json)).not.toThrow()
    })
  }
})
