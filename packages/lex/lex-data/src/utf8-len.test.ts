import { assert, describe, expect, it } from 'vitest'
import { utf8LenCompute, utf8LenNode } from './utf8-len.js'

describe.each([utf8LenNode, utf8LenCompute])('{name}', (utf8Len) => {
  assert(utf8Len, 'utf8Len should be defined')
  it('computes utf8 string length', () => {
    expect(utf8Len('a')).toBe(1)
    expect(utf8Len('~')).toBe(1)
    expect(utf8Len('ö')).toBe(2)
    expect(utf8Len('ñ')).toBe(2)
    expect(utf8Len('©')).toBe(2)
    expect(utf8Len('⽘')).toBe(3)
    expect(utf8Len('☎')).toBe(3)
    expect(utf8Len('𓋓')).toBe(4)
    expect(utf8Len('😀')).toBe(4)
    expect(utf8Len('👨‍👩‍👧‍👧')).toBe(25)
    // high surrogate with no low surrogate
    expect(utf8Len('\uD83D')).toBe(3)
    // low surrogate with no high surrogate
    expect(utf8Len('\uDC00')).toBe(3)
  })
})
