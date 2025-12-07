import { isTypedLexMap } from './lex'

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
