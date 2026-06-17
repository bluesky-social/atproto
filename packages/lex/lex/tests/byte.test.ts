import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('com.example.byteLength', () => {
  it('Applies bytes length constraints', () => {
    com.example.byteLength.$parse({
      $type: 'com.example.byteLength',
      bytes: new Uint8Array([1, 2, 3]),
    })
    expect(() =>
      com.example.byteLength.$parse({
        $type: 'com.example.byteLength',
        bytes: new Uint8Array([1]),
      }),
    ).toThrow('bytes too small (minimum 2, got 1) at $.bytes')
    expect(() =>
      com.example.byteLength.$parse({
        $type: 'com.example.byteLength',
        bytes: new Uint8Array([1, 2, 3, 4, 5]),
      }),
    ).toThrow('bytes too big (maximum 4, got 5) at $.bytes')
  })
})
