import { timingSafeStringEqual } from '../src/util/timing-safe.js'

describe('timingSafeStringEqual', () => {
  it('matches === for equal and different strings', () => {
    expect(timingSafeStringEqual('hunter2', 'hunter2')).toBe(true)
    expect(timingSafeStringEqual('hunter2', 'hunter3')).toBe(false)
    expect(timingSafeStringEqual('hunter2', 'hunter22')).toBe(false)
    expect(timingSafeStringEqual('hunter2', 'hunter')).toBe(false)
  })

  it('treats empty strings like ===', () => {
    expect(timingSafeStringEqual('', '')).toBe(true)
    expect(timingSafeStringEqual('', 'x')).toBe(false)
    expect(timingSafeStringEqual('x', '')).toBe(false)
  })

  it('compares non-ASCII strings by code unit', () => {
    expect(timingSafeStringEqual('pässwörd', 'pässwörd')).toBe(true)
    expect(timingSafeStringEqual('pässwörd', 'passwörd')).toBe(false)
    expect(timingSafeStringEqual('🔑', '🔑')).toBe(true)
  })

  it('keeps distinct lone surrogates distinct', () => {
    // utf8 encodes every lone surrogate as U+FFFD, so these would compare equal
    expect(timingSafeStringEqual('\ud800', '\ud801')).toBe(false)
    expect(timingSafeStringEqual('\ud800', '\udc00')).toBe(false)
    expect(timingSafeStringEqual('a\ud800', 'a�')).toBe(false)
    expect(timingSafeStringEqual('\ud800', '\ud800')).toBe(true)
  })
})
