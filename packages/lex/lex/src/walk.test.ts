import { describe, expect, it } from 'vitest'
import {
  Procedure,
  Query,
  RecordSchema,
  Subscription,
} from '@atproto/lex-schema'
import * as lexicons from '../tests/lexicons/index.js'
import { walk } from './walk.js'

describe(walk, () => {
  it('walks every definition in a lexicon document once', () => {
    const { kitchenSink } = lexicons.com.example

    expect([...walk(kitchenSink)]).toStrictEqual([
      kitchenSink.main,
      kitchenSink.object,
      kitchenSink.subobject,
    ])
  })

  it('walks a generated lexicon namespace', () => {
    const schemas = [...walk(lexicons)]

    expect(new Set(schemas).size).toBe(schemas.length)
    expect(schemas).toEqual(
      expect.arrayContaining([
        lexicons.com.example.kitchenSink.main,
        lexicons.com.example.kitchenSink.object,
        lexicons.com.example.procedure.main,
        lexicons.com.example.query.main,
        lexicons.com.example.subscription.main,
      ]),
    )
    expect(schemas.some((schema) => schema instanceof RecordSchema)).toBe(true)
    expect(schemas.some((schema) => schema instanceof Procedure)).toBe(true)
    expect(schemas.some((schema) => schema instanceof Query)).toBe(true)
    expect(schemas.some((schema) => schema instanceof Subscription)).toBe(true)
  })
})
