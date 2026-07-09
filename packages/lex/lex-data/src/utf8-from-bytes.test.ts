import { assert, describe, expect, it, test } from 'vitest'
import { utf8FromBytesNative, utf8FromBytesNode } from './utf8-from-bytes.js'

describe.each([utf8FromBytesNative, utf8FromBytesNode] as const)(
  '%o',
  (utf8FromBytes) => {
    // Tests should run in NodeJS where implementations are either available or
    // polyfilled
    assert(utf8FromBytes, 'utf8FromBytes implementation should not be null')

    describe(utf8FromBytes, () => {
      it('decodes empty Uint8Array', () => {
        const decoded = utf8FromBytes(new Uint8Array(0))
        expect(typeof decoded).toBe('string')
        expect(decoded).toBe('')
      })

      it('decodes 10MB', () => {
        const bytes = Buffer.allocUnsafe(10_000_000).fill('🐩')
        const decoded = utf8FromBytes(bytes)
        expect(decoded).toBe('🐩'.repeat(10_000_000 / 4))
      })

      test.each([
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
      ])('decodes "%s"', (string) => {
        const buffer = Buffer.from(string, 'utf8')
        const decoded = utf8FromBytes(buffer)
        expect(decoded).toBe(string)
      })
    })
  },
)
