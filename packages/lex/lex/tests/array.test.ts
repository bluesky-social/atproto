import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('array', () => {
  it('Applies array length constraints', () => {
    com.example.arrayLength.$parse({
      $type: 'com.example.arrayLength',
      array: [1, 2, 3],
    })
    expect(() =>
      com.example.arrayLength.$parse({
        $type: 'com.example.arrayLength',
        array: [1],
      }),
    ).toThrow('array too small (minimum 2, got 1) at $.array')
    expect(() =>
      com.example.arrayLength.$parse({
        $type: 'com.example.arrayLength',
        array: [1, 2, 3, 4, 5],
      }),
    ).toThrow('array too big (maximum 4, got 5) at $.array')
  })

  it('Applies array item constraints', () => {
    expect(() =>
      com.example.arrayLength.$parse({
        $type: 'com.example.arrayLength',
        array: [1, '2', 3],
      }),
    ).toThrow('Expected integer value type (got string) at $.array[1]')
    expect(() =>
      com.example.arrayLength.$parse({
        $type: 'com.example.arrayLength',
        array: [1, undefined, 3],
      }),
    ).toThrow('Expected integer value type (got undefined) at $.array[1]')
  })
})
