import {
  graphemeLenInternal,
  graphemeLenSegmenter,
} from './utf8-grapheme-len.js'

describe('graphemeLenSegmenter', () => {
  it('computes grapheme length', () => {
    expect(graphemeLenSegmenter!('a')).toBe(1)
    expect(graphemeLenSegmenter!('~')).toBe(1)
    expect(graphemeLenSegmenter!('ö')).toBe(1)
    expect(graphemeLenSegmenter!('ñ')).toBe(1)
    expect(graphemeLenSegmenter!('©')).toBe(1)
    expect(graphemeLenSegmenter!('⽘')).toBe(1)
    expect(graphemeLenSegmenter!('☎')).toBe(1)
    expect(graphemeLenSegmenter!('𓋓')).toBe(1)
    expect(graphemeLenSegmenter!('😀')).toBe(1)
    expect(graphemeLenSegmenter!('👨‍👩‍👧‍👧')).toBe(1)
    expect(graphemeLenSegmenter!('a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧')).toBe(10)
    // https://github.com/bluesky-social/atproto/issues/4321
    expect(graphemeLenSegmenter!('नमस्ते')).toBe(3)
  })
})

describe('graphemeLenInternal', () => {
  it('computes grapheme length', () => {
    expect(graphemeLenInternal('a')).toBe(1)
    expect(graphemeLenInternal('~')).toBe(1)
    expect(graphemeLenInternal('ö')).toBe(1)
    expect(graphemeLenInternal('ñ')).toBe(1)
    expect(graphemeLenInternal('©')).toBe(1)
    expect(graphemeLenInternal('⽘')).toBe(1)
    expect(graphemeLenInternal('☎')).toBe(1)
    expect(graphemeLenInternal('𓋓')).toBe(1)
    expect(graphemeLenInternal('😀')).toBe(1)
    expect(graphemeLenInternal('👨‍👩‍👧‍👧')).toBe(1)
    expect(graphemeLenInternal('a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧')).toBe(10)
    // https://github.com/bluesky-social/atproto/issues/4321
    expect(graphemeLenInternal('नमस्ते')).toBe(3)
  })
})
