import { describe, expect, it } from 'vitest'
import { l } from '@atproto/lex-schema'
import * as com from './lexicons/com.js'

describe('defaults', () => {
  it('Generates default properties', () => {
    const result = com.example.default.$parse({
      $type: 'com.example.default',
      object: {},
    })
    expect(result).toStrictEqual({
      $type: 'com.example.default',
      boolean: false,
      integer: 0,
      string: '',
      object: {
        boolean: true,
        integer: 1,
        string: 'x',
      },
    })
    expect(result).not.toHaveProperty('datetime')
  })

  it('properly handles defaults', () => {
    const int = l.integer()
    expect(int.safeParse(undefined).success).toBe(false)
    expect(int.safeValidate(undefined).success).toBe(false)

    const intOpt = l.optional(int)
    expect(intOpt.parse(undefined)).toBe(undefined)
    expect(intOpt.validate(undefined)).toBe(undefined)

    const intOptOpt = l.optional(l.optional(int))
    expect(intOptOpt.parse(undefined)).toBe(undefined)
    expect(intOptOpt.validate(undefined)).toBe(undefined)

    const intDef = l.withDefault(int, 42)
    expect(intDef.parse(undefined)).toBe(42)
    expect(intDef.safeValidate(undefined).success).toBe(false)

    const intDefOpt = l.optional(intDef)
    expect(intDefOpt.parse(undefined)).toBe(42)
    expect(intDefOpt.validate(undefined)).toBe(undefined)

    const intDefOptOpt = l.optional(l.optional(intDef))
    expect(intDefOptOpt.parse(undefined)).toBe(42)
    expect(intDefOptOpt.validate(undefined)).toBe(undefined)

    const mySchema = l.object({
      foo: l.optional(l.withDefault(l.string(), 'aze')),
    })

    expect(mySchema.parse({})).toStrictEqual({ foo: 'aze' })
    expect(mySchema.validate({})).toStrictEqual({})
  })
})
