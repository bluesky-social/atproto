import { describe, expect, test } from 'vitest'
import { InvalidDidError, assertDidString, isDidString } from '../src'
import { readLines } from './utils'

function expectValidDid(h: string) {
  expect(isDidString(h)).toBe(true)
  expect(() => assertDidString(h)).not.toThrow()
}
function expectInvalidDid(h: string) {
  expect(isDidString(h)).toBe(false)
  expect(() => assertDidString(h)).toThrow(InvalidDidError)
}

describe('spec details', () => {
  describe('valid DIDs', () => {
    for (const value of [
      'did:method:val',
      'did:method:VAL',
      'did:method:val123',
      'did:method:123',
      'did:method:val-two',
      'did:method:val_two',
      'did:method:val.two',
      'did:method:val:two',
      'did:method:val%BB',
      'did:method:' + 'v'.repeat(240),
      'did:m:v',
      'did:method::::val',
      'did:method:-',
      'did:method:-:_:.:%AB',
      'did:method:.',
      'did:method:_',
      'did:method::.',
      'did:onion:2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid',
      'did:method:val%BB',
    ]) {
      test(value, () => {
        expectValidDid(value)
      })
    }
  })

  describe('invalid DIDs', () => {
    for (const value of [
      'did',
      'didmethodval',
      'method:did:val',
      'did:method:',
      'didmethod:val',
      'did:methodval',
      ':did:method:val',
      'did.method.val',
      'did:method:val:',
      'DID:method:val',
      'did:METHOD:val',
      'did:m123:val',

      'did:method:' + 'v'.repeat(2048),

      'did:method:val/two',
      'did:method:val?two',
      'did:method:val#two',

      // Invalid URL encoding
      'did:method:val%B',
      'did:method:v%BZal',
      'did:method:val%',
      'did:method:val%zz',
      'did:method:-:_:.:%ab',
      'did:method:val%bb',
    ]) {
      test(value, () => {
        expectInvalidDid(value)
      })
    }
  })
})

describe('interop', () => {
  describe('valid DIDs', () => {
    for (const value of readLines(
      `${__dirname}/interop-files/did_syntax_valid.txt`,
    )) {
      test(value, () => {
        expectValidDid(value)
      })
    }
  })

  describe('invalid DIDs', () => {
    for (const value of readLines(
      `${__dirname}/interop-files/did_syntax_invalid.txt`,
    )) {
      test(value, () => {
        expectInvalidDid(value)
      })
    }
  })
})

describe('real DID values', () => {
  for (const value of [
    'did:example:123456789abcdefghi',
    'did:plc:7iza6de2dwap2sbkpav7c6c6',
    'did:web:example.com',
    'did:web:localhost%3A1234',
    'did:key:zQ3shZc2QzApp2oymGvQbzP8eKheVshBHbU4ZYjeXqwSKEn6N',
    'did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a',
  ]) {
    test(value, () => {
      expectValidDid(value)
    })
  }
})
