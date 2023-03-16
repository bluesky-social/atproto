import { graphemeLen, utf8Len } from '../src'

describe('string', () => {
  it('calculates utf8 string length', () => {
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
  })

  it('caluclates grapheme length', () => {
    expect(graphemeLen('a')).toBe(1)
    expect(graphemeLen('~')).toBe(1)
    expect(graphemeLen('ö')).toBe(1)
    expect(graphemeLen('ñ')).toBe(1)
    expect(graphemeLen('©')).toBe(1)
    expect(graphemeLen('⽘')).toBe(1)
    expect(graphemeLen('☎')).toBe(1)
    expect(graphemeLen('𓋓')).toBe(1)
    expect(graphemeLen('😀')).toBe(1)
    expect(graphemeLen('👨‍👩‍👧‍👧')).toBe(1)
    expect(graphemeLen('a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧')).toBe(10)
  })
})
