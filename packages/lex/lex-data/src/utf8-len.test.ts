import { describe, expect, it } from 'vitest'
import { utf8LenCompute, utf8LenNode } from './utf8-len.js'

describe(utf8LenNode!, () => {
  it('computes utf8 string length', () => {
    expect(utf8LenNode!('a')).toBe(1)
    expect(utf8LenNode!('~')).toBe(1)
    expect(utf8LenNode!('ö')).toBe(2)
    expect(utf8LenNode!('ñ')).toBe(2)
    expect(utf8LenNode!('©')).toBe(2)
    expect(utf8LenNode!('⽘')).toBe(3)
    expect(utf8LenNode!('☎')).toBe(3)
    expect(utf8LenNode!('𓋓')).toBe(4)
    expect(utf8LenNode!('😀')).toBe(4)
    expect(utf8LenNode!('👨‍👩‍👧‍👧')).toBe(25)
  })
})

describe(utf8LenCompute, () => {
  it('computes utf8 string length', () => {
    expect(utf8LenCompute('a')).toBe(1)
    expect(utf8LenCompute('~')).toBe(1)
    expect(utf8LenCompute('ö')).toBe(2)
    expect(utf8LenCompute('ñ')).toBe(2)
    expect(utf8LenCompute('©')).toBe(2)
    expect(utf8LenCompute('⽘')).toBe(3)
    expect(utf8LenCompute('☎')).toBe(3)
    expect(utf8LenCompute('𓋓')).toBe(4)
    expect(utf8LenCompute('😀')).toBe(4)
    expect(utf8LenCompute('👨‍👩‍👧‍👧')).toBe(25)
  })
})
