import { describe, expect, test } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import { lexValue } from './lex-value.js'

const schema = lexValue()

describe(lexValue, () => {
  describe('valid values', () => {
    for (const { note, value } of [
      { note: 'string', value: 'hello' },
      { note: 'boolean true', value: true },
      { note: 'boolean false', value: false },
      { note: 'null', value: null },
      { note: 'integer', value: 42 },
      { note: 'negative integer', value: -1 },
      { note: 'zero', value: 0 },
      { note: 'Uint8Array', value: new Uint8Array([1, 2, 3]) },
      {
        note: 'Cid',
        value: parseCid(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
      },
      { note: 'empty plain object', value: {} },
      {
        note: 'object with Lex values',
        value: {
          a: 123,
          b: 'blah',
          c: true,
          d: null,
          e: new Uint8Array([1, 2, 3]),
          f: { nested: 'value' },
          g: [1, 2, 3],
        },
      },
      { note: 'empty array', value: [] },
      {
        note: 'array with Lex values',
        value: [
          123,
          'blah',
          true,
          null,
          new Uint8Array([1, 2, 3]),
          { nested: 'value' },
          [1, 2, 3],
        ],
      },
    ]) {
      test(note, () => {
        const result = schema.safeParse(value)
        expect(result.success).toBe(true)
      })
    }
  })

  describe('invalid values', () => {
    for (const { note, value } of [
      { note: 'float', value: 42.5 },
      { note: 'undefined', value: undefined },
      { note: 'function', value: () => {} },
      { note: 'Date object', value: new Date() },
      { note: 'Map object', value: new Map() },
      { note: 'Set object', value: new Set() },
      { note: 'class instance', value: new (class A {})() },
      { note: 'object with function value', value: { a: 123, b: () => {} } },
      {
        note: 'object with undefined value',
        value: { a: 123, b: undefined },
      },
      { note: 'array with function', value: [123, 'blah', () => {}] },
      { note: 'array with undefined', value: [123, 'blah', undefined] },
    ]) {
      test(note, () => {
        const result = schema.safeParse(value)
        expect(result.success).toBe(false)
      })
    }
  })
})
