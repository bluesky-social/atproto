import { describe, expect, test } from 'vitest'
import { validVectors } from './fixtures.test.js'
import { lexToJson } from './lex-to-json.js'

describe(lexToJson, () => {
  describe('valid vectors', () => {
    for (const { name, json, lex } of validVectors) {
      test(name, () => {
        expect(lexToJson(lex)).toStrictEqual(json)
      })
    }
  })
})
