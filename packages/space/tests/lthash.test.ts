import { describe, expect, it } from 'vitest'
import { LTHASH_STATE_BYTES, LtHash } from '../src/index.js'

const ZEROS = new Uint8Array(LTHASH_STATE_BYTES)

describe('LtHash', () => {
  it('starts as 2048 zero bytes', () => {
    expect(new LtHash().state()).toEqual(ZEROS)
    expect(new LtHash().isEmpty()).toBe(true)
  })

  it('add then remove returns to the zero state', () => {
    const h = new LtHash()
    h.add('a')
    expect(h.state()).not.toEqual(ZEROS)
    h.remove('a')
    expect(h.state()).toEqual(ZEROS)
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

  it('is a multiset — a double add does not cancel out', () => {
    const h = new LtHash().add('a').add('a')
    expect(h.isEmpty()).toBe(false)
    h.remove('a')
    expect(h.equals(new LtHash().add('a'))).toBe(true)
  })

  describe('state round-trips', () => {
    it('resumes from persisted state', () => {
      const a = new LtHash().add('a').add('b')
      expect(new LtHash(a.state()).equals(a)).toBe(true)
    })

    it('treats nullish state as empty', () => {
      expect(new LtHash(null).isEmpty()).toBe(true)
      expect(new LtHash(undefined).isEmpty()).toBe(true)
    })

    it('rejects wrong-length state', () => {
      expect(() => new LtHash(new Uint8Array(32))).toThrow(/must be 2048 bytes/)
    })

    it('does not alias the state it was built from', () => {
      const state = new Uint8Array(LTHASH_STATE_BYTES)
      state[0] = 0xff
      const h = new LtHash(state)
      state[0] = 0x00
      expect(h.state()[0]).toBe(0xff)
    })

    it('does not alias the state it hands out', () => {
      const h = new LtHash().add('a')
      const state = h.state()
      state[0] ^= 0xff
      expect(h.state()).not.toEqual(state)
    })
  })

  // How a caller stages a change without committing it: build from `state()`,
  // mutate the copy, and leave the original where it was.
  it('a hash built from another state does not share it', () => {
    const original = new LtHash().add('a')
    const staged = new LtHash(original.state()).add('b')
    expect(original.equals(staged)).toBe(false)
    expect(original.equals(new LtHash().add('a'))).toBe(true)
  })

  describe('digest', () => {
    it('is 32 bytes, and sha256 of the zero state when empty', () => {
      const digest = new LtHash().digest()
      expect(digest).toHaveLength(32)
      expect(Buffer.from(digest).toString('hex')).toBe(
        'e5a00aa9991ac8a5ee3109844d84a55583bd20572ad3ffcd42792f3c36b183ad',
      )
    })

    it('snapshot vector locks the algorithm', () => {
      // 1024 lanes of u16 mod 2^16, elements expanded with BLAKE3 XOF at
      // dkLen=2048, summed lane-wise. If this changes, persisted state must be
      // recomputed.
      const h = new LtHash().add('one').add('two')
      expect(Buffer.from(h.digest()).toString('hex')).toBe(
        'ae05cb6d224379d9710c290c8529945c5b0e0fde9ead30b9699057ce701c63e7',
      )
    })
  })
})
