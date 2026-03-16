import { describe, expect, test } from 'vitest'
import { InvalidDidError, assertDidString, isDidString } from '../src'
import { readLines } from './utils'

const ROOT_DIR = `${__dirname}/../../../`

function testValidDid(value: string) {
  test(value, () => {
    expect(isDidString(value)).toBe(true)
    expect(() => assertDidString(value)).not.toThrow()
  })
}
function testInvalidDid(value: string) {
  test(value, () => {
    expect(isDidString(value)).toBe(false)
    expect(() => assertDidString(value)).toThrow(InvalidDidError)
  })
}

describe('additional tests (not covered by interop)', () => {
  // @ts-expect-error
  testInvalidDid(4)
  // @ts-expect-error
  testInvalidDid(true)
  // @ts-expect-error
  testInvalidDid(Symbol.iterator)
  // @ts-expect-error
  testInvalidDid(null)
  // @ts-expect-error
  testInvalidDid(undefined)
  // @ts-expect-error
  testInvalidDid([])
  // @ts-expect-error
  testInvalidDid({ toString: () => 'did:method:val' })

  // Cannot end with ":"
  testInvalidDid('did:method::::')
  testValidDid('did:method::::::a')

  // Length boundary
  testValidDid('did:method:' + 'v'.repeat(2048 - 'did:method:'.length))
  testInvalidDid('did:method:' + 'v'.repeat(2048 - 'did:method:'.length + 1))
})

describe('did_syntax_invalid.txt', () => {
  for (const value of readLines(
    `${ROOT_DIR}/interop-test-files/syntax/did_syntax_invalid.txt`,
  )) {
    testInvalidDid(value)
  }
})

describe('did_syntax_valid.txt', () => {
  for (const value of readLines(
    `${ROOT_DIR}/interop-test-files/syntax/did_syntax_valid.txt`,
  )) {
    testValidDid(value)
  }
})

describe('did_parse_invalid.txt', () => {
  for (const value of readLines(
    `${ROOT_DIR}/interop-test-files/syntax/did_parse_invalid.txt`,
  )) {
    // @NOTE While semantically invalid, these DIDs are syntactically valid
    testValidDid(value)
  }
})

describe('did_real.txt', () => {
  for (const value of readLines(
    `${ROOT_DIR}/interop-test-files/syntax/did_real.txt`,
  )) {
    testValidDid(value)
  }
})
