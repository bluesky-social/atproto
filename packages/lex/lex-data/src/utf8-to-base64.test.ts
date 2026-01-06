import { assert, describe, expect, it } from 'vitest'
import { utf8ToBase64Node, utf8ToBase64Ponyfill } from './utf8-to-base64.js'

const strings = [
  'Hello, World!',
  '¡Hola, Mundo!',
  'こんにちは世界',
  '😀👩‍💻🌍',
  '',
  '𓀀𓁐𓂀𓃰𓄿𓅱𓆑𓇋𓈖𓉔𓊃𓋴𓌳𓍿𓎛𓏏',
]

for (const utf8ToBase64 of [utf8ToBase64Node, utf8ToBase64Ponyfill] as const) {
  assert(utf8ToBase64, 'implementation should not be null')

  describe(utf8ToBase64, () => {
    it('encodes utf8 string to base64', () => {
      for (const text of strings) {
        const b64 = Buffer.from(text, 'utf8')
          .toString('base64')
          .replaceAll('=', '') // utf8ToBase64 omits padding
        const encoded = utf8ToBase64(text, 'base64')
        expect(encoded).toBe(b64)
      }
    })

    it('encodes utf8 string to base64url', () => {
      for (const text of strings) {
        const b64u = Buffer.from(text, 'utf8').toString('base64url')
        const encoded = utf8ToBase64(text, 'base64url')
        expect(encoded).toBe(b64u)
      }
    })
  })
}
