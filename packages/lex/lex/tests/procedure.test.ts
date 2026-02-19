import { describe, expect, expectTypeOf, it } from 'vitest'
import { UnknownString } from '@atproto/lex-schema'
import * as com from './lexicons/com.js'

describe('com.example.procedure', () => {
  it('Passes valid parameters', () => {
    const paramResult = com.example.procedure.$params.$parse({
      boolean: true,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
      def: 1,
    })
    expect(paramResult).toStrictEqual({
      boolean: true,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
      def: 1,
    })
  })

  it('Passes valid inputs', () => {
    com.example.procedure.$input.schema.$parse({
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      float: 123.45,
      integer: 123,
      string: 'string',
    })
  })

  it('Validates input property type', () => {
    expect(() => {
      com.example.procedure.$input.schema.$parse({
        object: { boolean: 'string' },
        array: ['one', 'two'],
        boolean: true,
        float: 123.45,
        integer: 123,
        string: 'string',
      })
    }).toThrow('Expected boolean value type at $.object.boolean (got string)')
  })

  it('Rejects missing properties', () => {
    expect(() => {
      com.example.procedure.$input.schema.$parse({})
    }).toThrow('Missing required key "object" at $')
  })

  it('Passes valid outputs', () => {
    com.example.procedure.$output.schema.$parse({
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
      com.example.procedure.$output.schema.$parse({})
    }).toThrow('Missing required key "object" at $')
  })

  it('properly types knownValues in params', () => {
    expectTypeOf<com.example.procedureKnownValues.$Params>().toMatchObjectType<{
      status?: 'active' | 'inactive' | UnknownString
    }>()
  })

  it('properly types knownValues in input body', () => {
    expectTypeOf<com.example.procedureKnownValues.$InputBody>().toMatchObjectType<{
      role: 'admin' | 'user' | UnknownString
    }>()
  })
})
