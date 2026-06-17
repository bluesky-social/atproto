import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('com.example.4-2.unsafeDefs', () => {
  it('allows accessing defs with unsafe characters', () => {
    const input = {
      $type: 'com.example.4-2.unsafeDefs#ob-je-c$t',
      foo: 'bar',
    }
    const result = com.example['4-2'].unsafeDefs['ob-je-c$t'].$parse({
      ...input,
    })
    expect(result).toStrictEqual(input)
  })

  it('allows accessing defs that are reserved words', () => {
    const input = 9
    const result = com.example['4-2'].unsafeDefs['9'].$parse(input)
    expect(result).toBe(input)
  })
})
