import { isLexValue, isTypedLexMap } from './lex'

describe('isLexValue', () => {
  describe('valid values', () => {
    for (const { note, value } of [
      { note: 'string', value: 'hello' },
      { note: 'boolean', value: true },
      { note: 'null', value: null },
      { note: 'Uint8Array', value: new Uint8Array([1, 2, 3]) },
      {
        note: 'Cid',
        value: { code: 1, version: 1, multihash: new Uint8Array([18, 32]) },
      },
      {
        note: 'record with Lex values',
        value: {
          a: 123,
          b: 'blah',
          c: true,
          d: null,
          e: new Uint8Array([1, 2, 3]),
          f: {
            nested: 'value',
          },
          g: [1, 2, 3],
        },
      },
      {
        note: 'list with Lex values',
        value: [
          123,
          'blah',
          true,
          null,
          new Uint8Array([1, 2, 3]),
          {
            nested: 'value',
          },
          [1, 2, 3],
        ],
      },
    ]) {
      it(note, () => {
        expect(isLexValue(value)).toBe(true)
      })
    }
  })

  describe('invalid values', () => {
    for (const { note, value } of [
      { note: 'float', value: 123.456 },
      { note: 'undefined', value: undefined },
      { note: 'function', value: () => {} },
      {
        note: 'record with non-Lex value',
        value: {
          a: 123,
          b: () => {},
        },
      },
      {
        note: 'list with non-Lex value',
        value: [123, 'blah', () => {}],
      },
    ]) {
      it(note, () => {
        expect(isLexValue(value)).toBe(false)
      })
    }
  })

  it('handles cyclic structures', () => {
    const record: any = {
      a: 123,
      b: 'blah',
    }
    record.c = record

    expect(isLexValue(record)).toBe(false)

    const list: any[] = [123, 'blah']
    list.push(list)

    expect(isLexValue(list)).toBe(false)

    const complex: any = {
      a: {
        b: [1, 2, 3],
      },
    }
    complex.a.b.push(complex)

    expect(isLexValue(complex)).toBe(false)
  })

  it('handles deeply nested structures', () => {
    type Value = null | { nested: Value }
    let value: Value = null
    for (let i = 0; i < 1_000_000; i++) {
      value = { nested: value }
    }
    expect(isLexValue(value)).toBe(true)
  })
})

describe('isLexMap', () => {
  it('returns true for valid LexMap', () => {
    const record = {
      a: 123,
      b: 'blah',
      c: true,
      d: null,
      e: new Uint8Array([1, 2, 3]),
      f: {
        nested: 'value',
      },
      g: [1, 2, 3],
    }
    expect(isTypedLexMap(record)).toBe(false)
  })

  it('returns false for non-records', () => {
    const values = [
      123,
      'blah',
      true,
      null,
      new Uint8Array([1, 2, 3]),
      [1, 2, 3],
    ]
    for (const value of values) {
      expect(isTypedLexMap(value)).toBe(false)
    }
  })

  it('returns false for records with non-Lex values', () => {
    expect(
      // @ts-expect-error
      isTypedLexMap({
        a: 123,
        b: () => {},
      }),
    ).toBe(false)
    expect(
      isTypedLexMap({
        a: 123,
        b: undefined,
      }),
    ).toBe(false)
  })
})

describe('isTypedLexMap', () => {
  describe('valid records', () => {
    for (const { note, json } of [
      {
        note: 'trivial record',
        json: {
          $type: 'com.example.blah',
          a: 123,
          b: 'blah',
        },
      },
      {
        note: 'float, but integer-like',
        json: {
          $type: 'com.example.blah',
          a: 123.0,
          b: 'blah',
        },
      },
      {
        note: 'empty list and object',
        json: {
          $type: 'com.example.blah',
          a: [],
          b: {},
        },
      },
    ]) {
      it(note, () => {
        expect(isTypedLexMap(json)).toBe(true)
      })
    }
  })

  describe('invalid records', () => {
    for (const { note, json } of [
      {
        note: 'float',
        json: {
          $type: 'com.example.blah',
          a: 123.456,
          b: 'blah',
        },
      },
      {
        note: 'record with $type null',
        json: {
          $type: null,
          a: 123,
          b: 'blah',
        },
      },
      {
        note: 'record with $type wrong type',
        json: {
          $type: 123,
          a: 123,
          b: 'blah',
        },
      },
      {
        note: 'record with empty $type string',
        json: {
          $type: '',
          a: 123,
          b: 'blah',
        },
      },
    ]) {
      it(note, () => {
        expect(isTypedLexMap(json)).toBe(false)
      })
    }
  })
})
