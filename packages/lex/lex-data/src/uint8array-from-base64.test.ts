import 'core-js/modules/es.uint8-array.from-base64.js'
import 'core-js/modules/es.uint8-array.to-base64.js'

import { assert, describe, expect, it } from 'vitest'
import {
  fromBase64Native,
  fromBase64Node,
  fromBase64Ponyfill,
} from './uint8array-from-base64.js'
import { ui8Equals } from './uint8array.js'

// @NOTE This test suite relies on the NodeJS Buffer implementation to generate
// valid base64 strings for testing.

// @NOTE b64 needs a test suite because fromBase64 implementations differ in
// their behavior when encountering invalid base64 strings. This is not the case
// for toBase64, which is straightforward and has no edge cases.

for (const fromBase64 of [
  fromBase64Native,
  fromBase64Node,
  fromBase64Ponyfill,
] as const) {
  // Tests should run in NodeJS where implementations are either available or
  // polyfilled (see core-js imports above).
  assert(fromBase64 !== null, 'fromBase64 implementation should not be null')

  describe(fromBase64.name, () => {
    describe('valid base64 strings', () => {
      it('decodes empty string', () => {
        const decoded = fromBase64('')
        expect(decoded).toBeInstanceOf(Uint8Array)
        expect(decoded.length).toBe(0)
      })

      it('decodes 10MB', () => {
        const bytes = Buffer.allocUnsafe(10_000_000).fill('🐩')
        const encoded = bytes.toString('base64')
        const decoded = fromBase64(encoded)
        expect(decoded).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(decoded, bytes)).toBe(true)
      })

      for (const buffer of [
        Buffer.from(''),
        Buffer.from('\0\0'),
        Buffer.from('\0\0\0'),
        Buffer.from('\0\0\0\0'),
        Buffer.from('__'),
        Buffer.from('é'),
        Buffer.from('àç'),
        Buffer.from('\0éàç'),
        Buffer.from('```'),
        Buffer.from('aaa'),
        Buffer.from('Hello, World!'),
        Buffer.from('😀😃😄😁😆😅😂🤣😊😇'),
        Buffer.from('👩‍💻👨‍💻👩‍🔬👨‍🔬👩‍🚀👨‍🚀'),
        Buffer.from('🌍🌎🌏🌐🪐🌟✨⚡🔥💧'),
        Buffer.from(new Uint8Array([0xfb, 0xff, 0xbf])),
        Buffer.from(new Uint8Array([0xfb, 0xff, 0xbf])),
        Buffer.from(new Uint8Array([0x4d])),
        Buffer.from(new Uint8Array([0x4d, 0x61])),
        Buffer.from(new Uint8Array([0x4d, 0x61, 0x6e])),
        Buffer.from(new Uint8Array([0x4d])),
        Buffer.from(new Uint8Array([0x4d, 0x61])),
        Buffer.from(new Uint8Array([0x00, 0x4d, 0x61, 0x6e, 0x00])),
      ]) {
        const base64 = buffer.toString('base64')
        const base64Unpadded = base64.replace(/=+$/, '')
        const base64url = buffer.toString('base64url') // No padding in base64url

        it(`decodes ${JSON.stringify(base64)}`, () => {
          const decoded = fromBase64(base64)
          expect(decoded).toBeInstanceOf(Uint8Array)
          expect(ui8Equals(decoded, buffer)).toBe(true)
        })

        it(`decodes ${JSON.stringify(base64url)} (base64url)`, () => {
          const decoded = fromBase64(base64url, 'base64url')
          expect(decoded).toBeInstanceOf(Uint8Array)
          expect(ui8Equals(decoded, buffer)).toBe(true)
        })

        if (base64 !== base64Unpadded) {
          it(`decodes ${JSON.stringify(base64Unpadded)} (unpadded)`, () => {
            const decoded = fromBase64(base64Unpadded)
            expect(decoded).toBeInstanceOf(Uint8Array)
            expect(ui8Equals(decoded, buffer)).toBe(true)
          })
        }
      }
    })

    describe('invalid base64 strings', () => {
      for (const invalidB64 of [
        'çç',
        'é',
        'YWJjZGU$$$',
        '@@@@',
        'abcd!',
        'ab=cd',
        // "YWFh" is "aaa" in base64
        'YWFh' + 'é',
        'YWFh' + 'éé',
        'YWFh' + 'ééé',
        'YWFh' + 'éééé',
        // Invalid padding
        'YWFh' + '=',
        'YWFh' + '==',
        'YWFh' + '===',
        'YWFh' + '====',
        'YWFh' + '=====',
        'YWFh' + '======',
        'TWEé',
        'TWE👍',
        // More invalid padding
        // 'TWE=', // 'Ma'
        'TWE=' + '=',
        'TWE=' + '==',
        // 'TQ==', // 'M'
        'TQ==' + '=',
        'TQ==' + '==',
      ] as const) {
        it(`throws on invalid base64 string "${invalidB64}"`, () => {
          expect(() => fromBase64(invalidB64)).toThrow()
        })
      }
    })
  })
}
