import { describe, expect, expectTypeOf, it } from 'vitest'
import { l } from '@atproto/lex-schema'
import * as com from './lexicons/com.js'

describe('com.example.space', () => {
  const space = com.example.space.main

  it('references the record schemas of its collections', () => {
    expect(space).toBeInstanceOf(l.Space)
    expect(space.collections).toEqual([com.example.spaceRecord.main])
    expectTypeOf(space.collections).toEqualTypeOf<
      readonly (typeof com.example.spaceRecord.main)[]
    >()
  })

  it('validates records against the referenced schemas', () => {
    const [collection] = space.collections
    const record = com.example.spaceRecord.$build({ meta: { text: 'hi' } })
    expect(collection.matches(record)).toBe(true)
    expect(collection.matches({ ...record, meta: { text: 1 } })).toBe(false)
  })
})
