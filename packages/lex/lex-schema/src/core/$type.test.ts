import { describe, expectTypeOf, it } from 'vitest'
import { LexMap } from '@atproto/lex-data'
import { Unknown$Type, Unknown$TypedObject } from './$type.js'

describe('Unknown$TypedObject', () => {
  it('allows assigning Unknown$TypedObject to LexMap', () => {
    function expectLexMap(_value: LexMap) {}

    const someObject: Unknown$TypedObject = {
      $type: 'some-type' as Unknown$Type,
      // @ts-expect-error should not allow arbitrary properties
      foo: 'bar',
    }

    expectTypeOf(someObject).toEqualTypeOf<Unknown$TypedObject>()

    expectLexMap(someObject)

    expectLexMap({
      arr: [someObject],
      val: someObject,
    })
  })
})
