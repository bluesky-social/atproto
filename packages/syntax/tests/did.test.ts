import { describe, expect, test } from 'vitest'
import { InvalidDidError, assertDidString, isDidString } from '../src'
import { readLines } from './utils'

const interopValid = readLines(
  `${__dirname}/interop-files/did_syntax_valid.txt`,
)
const interopInvalid = readLines(
  `${__dirname}/interop-files/did_syntax_invalid.txt`,
)

const readDidValues = [
  'did:example:123456789abcdefghi',
  'did:plc:7iza6de2dwap2sbkpav7c6c6',
  'did:web:example.com',
  'did:web:localhost%3A1234',
  'did:key:zQ3shZc2QzApp2oymGvQbzP8eKheVshBHbU4ZYjeXqwSKEn6N',
  'did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a',
]

const syntaxValid = [
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
]

const syntaxInvalid = [
  'did',
  'didmethodval',
  'method:did:val',
  'did:method:',
  'didmethod:val',
  'did:methodval',
  ':did:method:val',
  'did.method.val',
  'did:method:val:',
  'did:method:val%',
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
]

describe('enforces spec details', () => {
  describe('valid syntax', () => {
    for (const value of syntaxValid) {
      test(value, () => {
        expectValid(value)
      })
    }
  })

  describe('invalid syntax', () => {
    for (const value of syntaxInvalid) {
      test(value, () => {
        expectInvalid(value)
      })
    }
  })
})

describe('allows some real DID values', () => {
  for (const value of readDidValues) {
    test(value, () => {
      expectValid(value)
    })
  }
})

describe('conforms to interop valid DIDs', () => {
  for (const value of interopValid) {
    test(value, () => {
      expectValid(value)
    })
  }
})

describe('conforms to interop invalid DIDs', () => {
  for (const value of interopInvalid) {
    test(value, () => {
      expectInvalid(value)
    })
  }
})

function expectValid(h: string) {
  expect(isDidString(h)).toBe(true)
  assertDidString(h)
}
function expectInvalid(h: string) {
  expect(isDidString(h)).toBe(false)
  expect(() => assertDidString(h)).toThrow(InvalidDidError)
}
