import { describe, expect, it } from 'vitest'
import { graphemeLenNative, graphemeLenPonyfill } from './utf8-grapheme-len.js'

describe(graphemeLenNative!, () => {
  it('computes grapheme length', () => {
    expect(graphemeLenNative!('a')).toBe(1)
    expect(graphemeLenNative!('~')).toBe(1)
    expect(graphemeLenNative!('ö')).toBe(1)
    expect(graphemeLenNative!('ñ')).toBe(1)
    expect(graphemeLenNative!('©')).toBe(1)
    expect(graphemeLenNative!('⽘')).toBe(1)
    expect(graphemeLenNative!('☎')).toBe(1)
    expect(graphemeLenNative!('𓋓')).toBe(1)
    expect(graphemeLenNative!('😀')).toBe(1)
    expect(graphemeLenNative!('👨‍👩‍👧‍👧')).toBe(1)
    expect(graphemeLenNative!('a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧')).toBe(10)
    // https://github.com/bluesky-social/atproto/issues/4321
    expect(graphemeLenNative!('नमस्ते')).toBe(3)
  })
})

describe(graphemeLenPonyfill, () => {
  it('computes grapheme length', () => {
    expect(graphemeLenPonyfill('a')).toBe(1)
    expect(graphemeLenPonyfill('~')).toBe(1)
    expect(graphemeLenPonyfill('ö')).toBe(1)
    expect(graphemeLenPonyfill('ñ')).toBe(1)
    expect(graphemeLenPonyfill('©')).toBe(1)
    expect(graphemeLenPonyfill('⽘')).toBe(1)
    expect(graphemeLenPonyfill('☎')).toBe(1)
    expect(graphemeLenPonyfill('𓋓')).toBe(1)
    expect(graphemeLenPonyfill('😀')).toBe(1)
    expect(graphemeLenPonyfill('👨‍👩‍👧‍👧')).toBe(1)
    expect(graphemeLenPonyfill('a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧')).toBe(10)
    // https://github.com/bluesky-social/atproto/issues/4321
    expect(graphemeLenPonyfill('नमस्ते')).toBe(3)
  })
})
