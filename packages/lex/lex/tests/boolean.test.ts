import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('boolean', () => {
  it('Applies boolean const constraint', () => {
    com.example.boolConst.$parse({
      $type: 'com.example.boolConst',
      boolean: false,
    })

    expect(() =>
      com.example.boolConst.$parse({
        $type: 'com.example.boolConst',
        boolean: true,
      }),
    ).toThrow('Expected false (got true) at $.boolean')

    expect(() =>
      com.example.boolConst.$parse({
        $type: 'com.example.boolConst',
        boolean: 'true',
      }),
    ).toThrow('Expected false (got "true") at $.boolean')

    expect(() =>
      com.example.boolConst.$parse({
        $type: 'com.example.boolConst',
        boolean: 1,
      }),
    ).toThrow('Expected false (got 1) at $.boolean')
  })
})
