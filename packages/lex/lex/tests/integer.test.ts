import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('integer', () => {
  it('Applies integer range constraint', () => {
    com.example.integerRange.$parse({
      $type: 'com.example.integerRange',
      integer: 2,
    })
    expect(() =>
      com.example.integerRange.$parse({
        $type: 'com.example.integerRange',
        integer: 1,
      }),
    ).toThrow('integer too small (minimum 2) at $.integer (got 1)')
    expect(() =>
      com.example.integerRange.$parse({
        $type: 'com.example.integerRange',
        integer: 5,
      }),
    ).toThrow('integer too big (maximum 4) at $.integer (got 5)')
  })

  it('Applies integer enum constraint', () => {
    com.example.integerEnum.$parse({
      $type: 'com.example.integerEnum',
      integer: 2,
    })
    expect(() =>
      com.example.integerEnum.$parse({
        $type: 'com.example.integerEnum',
        integer: 0,
      }),
    ).toThrow('Expected one of 1 or 2 at $.integer (got 0)')
  })

  it('Applies integer const constraint', () => {
    com.example.integerConst.$parse({
      $type: 'com.example.integerConst',
      integer: 0,
    })
    expect(() =>
      com.example.integerConst.$parse({
        $type: 'com.example.integerConst',
        integer: 1,
      }),
    ).toThrow('Expected 0 at $.integer (got 1)')
  })

  it('Applies integer whole-number constraint', () => {
    expect(() =>
      com.example.integerRange.$parse({
        $type: 'com.example.integerRange',
        integer: 2.5,
      }),
    ).toThrow('Expected integer value type at $.integer (got float)')
  })
})
