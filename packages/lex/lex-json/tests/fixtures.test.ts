import { describe, expect, test } from 'vitest'
import { isPlainObject } from '@atproto/lex-data'
import { type JsonValue, jsonToLex } from '../src/index.js'
import invalidFixtures from './data-model-invalid.json' with { type: 'json' }
import validFixtures from './data-model-valid.json' with { type: 'json' }

function parseLexFixture(input: JsonValue) {
  const lex = jsonToLex(input, { strict: true })
  if (!isPlainObject(lex)) {
    throw new Error('Expected a plain object')
  }
}

describe('invalidFixtures', () => {
  test.each(invalidFixtures)('$note', async (fixture) => {
    expect(() => parseLexFixture(fixture.json)).toThrow()
  })
})

describe('validFixtures', () => {
  test.each(validFixtures)('$note', (fixture) => {
    expect(() => parseLexFixture(fixture.json)).not.toThrow()
  })
})
