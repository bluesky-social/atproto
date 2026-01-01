import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('defaults', () => {
  it('Handles default properties correctly', () => {
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
})
