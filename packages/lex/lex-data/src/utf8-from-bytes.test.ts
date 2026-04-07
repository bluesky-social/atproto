import { assert, describe, expect, it } from 'vitest'
import { utf8FromBytesNative, utf8FromBytesNode } from './utf8-from-bytes.js'

for (const utf8FromBytes of [utf8FromBytesNode, utf8FromBytesNative] as const) {
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

      it(`decodes ${JSON.stringify(string)}`, () => {
        const decoded = utf8FromBytes(buffer)
        expect(decoded).toBe(string)
      })
    }
  })
}
