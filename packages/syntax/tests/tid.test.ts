import { describe, expect, test } from 'vitest'
import { InvalidTidError, ensureValidTid } from '../src/index.js'
import { readInteropFile } from './_utils.ts'

describe('valid interop', () => {
  test.each(readInteropFile(`tid_syntax_valid.txt`))('%s', (value) => {
    ensureValidTid(value)
  })
})

describe('invalid interop', () => {
  test.each(readInteropFile(`tid_syntax_invalid.txt`))('%s', (value) => {
    expect(() => ensureValidTid(value)).toThrow(InvalidTidError)
  })
})
