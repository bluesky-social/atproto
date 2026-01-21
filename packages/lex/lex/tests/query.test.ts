import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('com.example.query', () => {
  describe('parameters', () => {
    it('passes valid parameters', () => {
      const queryResult = com.example.query.$params.$parse({
        boolean: true,
        integer: 123,
        string: 'string',
        array: ['x', 'y'],
      })
      expect(queryResult).toStrictEqual({
        boolean: true,
        integer: 123,
        string: 'string',
        array: ['x', 'y'],
        def: 0,
      })
    })

    it('preserves unknown parameters', () => {
      const queryResult = com.example.query.$params.$parse({
        boolean: true,
        integer: 123,
        unknown: 'property',
      })
      expect(queryResult).toStrictEqual({
        boolean: true,
        integer: 123,
        def: 0,
        unknown: 'property',
      })
    })

    it('passes valid parameters', () => {
      com.example.query.$params.$parse({
        boolean: true,
        integer: 123,
      })
    })

    it('rejects missing parameters', () => {
      expect(() =>
        com.example.query.$params.$parse({
          boolean: true,
        }),
      ).toThrow('Missing required key "integer" at $')
    })

    it('rejects undefined parameters', () => {
      expect(() =>
        com.example.query.$params.$parse({
          boolean: true,
          integer: undefined,
        }),
      ).toThrow('Expected integer value type at $.integer (got undefined)')
    })

    it('rejects invalid parameter value', () => {
      expect(() =>
        com.example.query.$params.$parse({
          boolean: 'string',
          integer: 123,
          string: 'string',
        }),
      ).toThrow('Expected boolean value type at $.boolean (got string)')
    })

    it('rejects invalid parameter type', () => {
      expect(() =>
        com.example.query.$params.$parse({
          boolean: true,
          integer: 123,
          float: 123.45,
        }),
      ).toThrow(
        'Expected one of boolean, integer, string or array value type at $.float (got float)',
      )

      expect(() =>
        com.example.query.$params.$parse({
          boolean: true,
          integer: 123,
          array: 'x',
        }),
      ).toThrow('Expected array value type at $.array (got string)')

      expect(() =>
        com.example.query.$params.$parse({
          boolean: true,
          integer: 123,
          array: 3,
        }),
      ).toThrow('Expected array value type at $.array (got integer)')

      expect(() =>
        com.example.query.$params.$parse({
          boolean: true,
          integer: 123,
          array: NaN,
        }),
      ).toThrow('Expected array value type at $.array (got NaN)')
    })

    it('properly infers the type of default parameters', () => {
      function returnDef(params: com.example.query.Params): number {
        return params.def
      }

      const parsed = com.example.query.$params.parse({
        boolean: true,
        integer: 123,
        string: 'string',
        array: ['x', 'y'],
      })

      expect(returnDef(parsed)).toBe(0)
    })
  })

  describe('output', () => {
    it('Passes valid outputs', () => {
      com.example.query.$output.schema.$parse({
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        float: 123.45,
        integer: 123,
        string: 'string',
      })
    })

    it('Rejects invalid output', () => {
      expect(() => {
        com.example.query.$output.schema.$parse({
          object: { boolean: 'string' },
          array: ['one', 'two'],
          boolean: true,
          float: 123.45,
          integer: 123,
          string: 'string',
        })
      }).toThrow('Expected boolean value type at $.object.boolean (got string)')
    })
  })
})
