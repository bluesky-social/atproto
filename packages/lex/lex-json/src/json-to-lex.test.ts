import { describe, expect, test } from 'vitest'
import { lexEquals } from '@atproto/lex-data'
import {
  acceptableVectors,
  invalidVectors,
  validVectors,
} from './fixtures.test.js'
import { jsonToLex } from './json-to-lex.js'

describe(jsonToLex, () => {
  describe('valid vectors', () => {
    describe('strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(lexEquals(jsonToLex(json, { strict: true }), lex)).toBe(true)

          expect(lexEquals(lex, jsonToLex(json, { strict: true }))).toBe(true)
        })
      }
    })

    describe('non-strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(lexEquals(jsonToLex(json, { strict: false }), lex)).toBe(true)

          expect(lexEquals(lex, jsonToLex(json, { strict: false }))).toBe(true)
        })
      }
    })
  })

  describe('acceptable vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: true })).toThrow()
        })
      }
    })

    describe('non-strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: false })).not.toThrow()
        })
      }
    })
  })

  describe('invalid vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: true })).toThrow()
        })
      }
    })

    describe('non-strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: false })).not.toThrow()
        })
      }
    })
  })
})
