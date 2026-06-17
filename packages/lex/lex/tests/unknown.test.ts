import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('unknown', () => {
  it('Handles unknowns correctly', () => {
    com.example.unknown.$parse({
      $type: 'com.example.unknown',
      unknown: { foo: 'bar' },
    })
    expect(() =>
      com.example.unknown.$parse({
        $type: 'com.example.unknown',
      }),
    ).toThrow('Missing required key "unknown" at $')
  })
})
