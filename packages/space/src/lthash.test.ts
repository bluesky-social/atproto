import { describe, expect, it } from 'vitest'
import { LTHASH_STATE_BYTES, LtHash } from './lthash.js'

const ZEROS = new Uint8Array(LTHASH_STATE_BYTES)

describe(LtHash, () => {
  it('starts as 2048 zero bytes, including from nullish state', () => {
    for (const hash of [
      new LtHash(),
      new LtHash(null),
      new LtHash(undefined),
    ]) {
      expect(hash.state()).toEqual(ZEROS)
      expect(hash.isEmpty()).toBe(true)
    }
  })

  it('returns to the zero state when an element is added then removed', () => {
    const hash = new LtHash().add('a')
    expect(hash.state()).not.toEqual(ZEROS)
    expect(hash.remove('a').state()).toEqual(ZEROS)
  })

  it('is order-independent', () => {
    const a = new LtHash().add('a').add('b')
    const b = new LtHash().add('b').add('a')
    expect(a.equals(b)).toBe(true)
    expect(a.digest()).toEqual(b.digest())
  })

  it('distinguishes different elements', () => {
    expect(new LtHash().add('a').equals(new LtHash().add('b'))).toBe(false)
  })

  it('is a multiset: adding an element twice does not cancel out', () => {
    const hash = new LtHash().add('a').add('a')
    expect(hash.isEmpty()).toBe(false)
    expect(hash.remove('a').equals(new LtHash().add('a'))).toBe(true)
  })

  it('resumes from persisted state', () => {
    const hash = new LtHash().add('a').add('b')
    expect(new LtHash(hash.state()).equals(hash)).toBe(true)
  })

  it('rejects state of the wrong length', () => {
    expect(() => new LtHash(new Uint8Array(32))).toThrow(
      new TypeError('LtHash state must be 2048 bytes, got 32'),
    )
  })

  it('does not alias the state it was built from', () => {
    const state = new Uint8Array(LTHASH_STATE_BYTES)
    state[0] = 0xff
    const hash = new LtHash(state)
    state[0] = 0x00
    expect(hash.state()[0]).toBe(0xff)
  })

  it('does not alias the state it hands out', () => {
    const hash = new LtHash().add('a')
    const state = hash.state()
    state[0] ^= 0xff
    expect(hash.state()).not.toEqual(state)
  })

  // Persisted state must be recomputed if this changes.
  it('digests a known set to a fixed value', () => {
    const hash = new LtHash().add('one').add('two')
    expect(Buffer.from(hash.digest()).toString('hex')).toBe(
      'ae05cb6d224379d9710c290c8529945c5b0e0fde9ead30b9699057ce701c63e7',
    )
  })
})
