import { describe, it } from 'vitest'
import { LexMap } from '@atproto/lex-data'
import { Unknown$TypedObject } from './$type.js'

describe('Unknown$TypedObject', () => {
  it('allows assigning Unknown$TypedObject to LexMap', () => {
    function expectLexMap(_value: LexMap) {}

    const someObject = {
      $type: 'some-type',
    } as Unknown$TypedObject

    expectLexMap(someObject)

    expectLexMap({
      arr: [someObject],
      val: someObject,
    })
  })
})
