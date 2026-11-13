import { describe, expect, test } from 'vitest'
import { InvalidRecordKeyError, ensureValidRecordKey } from '../src/index.js'
import { readInteropFile } from './_utils.ts'

describe('valid interop', () => {
  test.each(readInteropFile(`recordkey_syntax_valid.txt`))('%s', (value) => {
    ensureValidRecordKey(value)
  })
})

describe('invalid interop', () => {
  test.each(readInteropFile(`recordkey_syntax_invalid.txt`))('%s', (value) => {
    expect(() => ensureValidRecordKey(value)).toThrow(InvalidRecordKeyError)
  })
})
