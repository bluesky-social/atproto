import { assert, describe, expect, it } from 'vitest'
import {
  utf8FromBase64Node,
  utf8FromBase64Ponyfill,
} from './utf8-from-base64.js'

describe.each([utf8FromBase64Node, utf8FromBase64Ponyfill])(
  '%o',
  (utf8FromBase64) => {
    assert(utf8FromBase64, 'implementation should not be null')

    describe.each([
      'Hello, World!',
      '¡Hola, Mundo!',
      'こんにちは世界',
      '😀👩‍💻🌍',
      '',
      '𓀀𓁐𓂀𓃰𓄿𓅱𓆑𓇋𓈖𓉔𓊃𓋴𓌳𓍿𓎛𓏏',
    ])('%s', (text) => {
      it('decodes base64 to utf8 string', () => {
        const b64 = Buffer.from(text, 'utf8').toString('base64')
        const decoded = utf8FromBase64(b64, 'base64')
        expect(decoded).toBe(text)
      })

      it('decodes base64url to utf8 string', () => {
        const b64u = Buffer.from(text, 'utf8').toString('base64url')
        const decoded = utf8FromBase64(b64u, 'base64url')
        expect(decoded).toBe(text)
      })
    })
  },
)
