import 'core-js/modules/es.uint8-array.from-base64.js'
import 'core-js/modules/es.uint8-array.to-base64.js'
import { assert, describe, expect, it } from 'vitest'
import {
  toBase64Native,
  toBase64Node,
  toBase64Ponyfill,
} from './uint8array-to-base64.js'

for (const toBase64 of [
  toBase64Native,
  toBase64Node,
  toBase64Ponyfill,
] as const) {
  // Tests should run in NodeJS where implementations are either available or
  // polyfilled (see core-js imports above).
  assert(toBase64, 'toBase64 implementation should not be null')

  describe(toBase64, () => {
    describe('basic encoding', () => {
      it('encodes empty Uint8Array', () => {
        const encoded = toBase64(new Uint8Array(0))
        expect(typeof encoded).toBe('string')
        expect(encoded).toBe('')
      })

      it('encodes 10MB', () => {
        const bytes = Buffer.allocUnsafe(10_000_000).fill('🐩')
        const encoded = toBase64(bytes)
        expect(typeof encoded).toBe('string')
        // Verify by decoding back
        const decoded = Buffer.from(encoded, 'base64')
        expect(decoded.equals(bytes)).toBe(true)
      })
    })

    describe('base64 alphabet (default)', () => {
      for (const string of [
        '',
        '\0\0',
        '\0\0\0',
        '\0\0\0\0',
        '__',
        'é',
        'àç',
        '\0éàç',
        '```\x1b',
        'aaa',
        'Hello, World!',
        '😀😃😄😁😆😅😂🤣😊😇',
        '👩‍💻👨‍💻👩‍🔬👨‍🔬👩‍🚀👨‍🚀',
        '🌍🌎🌏🌐🪐🌟✨⚡🔥💧',
      ] as const) {
        const buffer = Buffer.from(string, 'utf8')
        const expected = buffer.toString('base64').replace(/=+$/, '')

        it(`encodes ${JSON.stringify(string)} as ${JSON.stringify(expected)}`, () => {
          const encoded = toBase64(buffer)
          expect(encoded).toBe(expected)
        })
      }
    })

    describe('base64url alphabet', () => {
      for (const string of [
        '',
        '\0\0',
        '\0\0\0',
        '\0\0\0\0',
        '__',
        'é',
        'àç',
        '\0éàç',
        '```\x1b',
        'aaa',
        'Hello, World!',
        '😀😃😄😁😆😅😂🤣😊😇',
        '👩‍💻👨‍💻👩‍🔬👨‍🔬👩‍🚀👨‍🚀',
        '🌍🌎🌏🌐🪐🌟✨⚡🔥💧',
      ] as const) {
        const buffer = Buffer.from(string, 'utf8')
        const expected = buffer.toString('base64url')

        it(`encodes ${JSON.stringify(string)} as ${JSON.stringify(expected)}`, () => {
          const encoded = toBase64(buffer, 'base64url')
          expect(encoded).toBe(expected)
        })
      }
    })

    describe('base64 vs base64url character differences', () => {
      // Test data that produces + and / in standard base64
      // These should become - and _ in base64url
      it('uses + and / for base64 alphabet', () => {
        // 0xfb, 0xff, 0xbf produces "+/+/" in base64
        const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
        const encoded = toBase64(bytes)
        expect(encoded).toContain('+')
        expect(encoded).toContain('/')
        expect(encoded).not.toContain('-')
        expect(encoded).not.toContain('_')
      })

      it('uses - and _ for base64url alphabet', () => {
        // Same bytes should use - and _ in base64url
        const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
        const encoded = toBase64(bytes, 'base64url')
        expect(encoded).toContain('-')
        expect(encoded).toContain('_')
        expect(encoded).not.toContain('+')
        expect(encoded).not.toContain('/')
      })
    })

    describe('padding behavior', () => {
      it('omits padding by default for 1-byte input', () => {
        // 1 byte -> 2 base64 chars + 2 padding
        const bytes = new Uint8Array([0x4d]) // 'M' -> 'TQ=='
        const encoded = toBase64(bytes)
        expect(encoded).toBe('TQ')
        expect(encoded).not.toContain('=')
      })

      it('omits padding by default for 2-byte input', () => {
        // 2 bytes -> 3 base64 chars + 1 padding
        const bytes = new Uint8Array([0x4d, 0x61]) // 'Ma' -> 'TWE='
        const encoded = toBase64(bytes)
        expect(encoded).toBe('TWE')
        expect(encoded).not.toContain('=')
      })

      it('no padding needed for 3-byte input', () => {
        // 3 bytes -> 4 base64 chars, no padding needed
        const bytes = new Uint8Array([0x4d, 0x61, 0x6e]) // 'Man' -> 'TWFu'
        const encoded = toBase64(bytes)
        expect(encoded).toBe('TWFu')
      })

      it('includes double padding when omitPadding: false for 1-byte input', () => {
        const bytes = new Uint8Array([0x4d]) // 'M' -> 'TQ=='
        const encoded = toBase64(bytes)
        expect(encoded).toBe('TQ')
      })

      it('includes single padding when omitPadding: false for 2-byte input', () => {
        const bytes = new Uint8Array([0x4d, 0x61]) // 'Ma' -> 'TWE='
        const encoded = toBase64(bytes)
        expect(encoded).toBe('TWE')
      })
    })

    describe('Uint8Array subarray handling', () => {
      it('correctly encodes a subarray', () => {
        const fullArray = new Uint8Array([0x00, 0x4d, 0x61, 0x6e, 0x00])
        const subarray = fullArray.subarray(1, 4) // 'Man'
        const encoded = toBase64(subarray)
        expect(encoded).toBe('TWFu')
      })

      it('correctly encodes a subarray with offset', () => {
        const buffer = new ArrayBuffer(10)
        const fullView = new Uint8Array(buffer)
        fullView.set([0x00, 0x00, 0x4d, 0x61, 0x6e, 0x00, 0x00])
        const subarray = new Uint8Array(buffer, 2, 3) // 'Man' at offset 2
        const encoded = toBase64(subarray)
        expect(encoded).toBe('TWFu')
      })
    })
  })
}
