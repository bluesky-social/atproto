import { cborEncode, cborToLexRecord } from '..'

describe('cborToLexRecord', () => {
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
        expect(cborToLexRecord(cborEncode(json))).toEqual(json)
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
        expect(() => cborToLexRecord(cborEncode(json))).toThrow()
      })
    }
  })
})
