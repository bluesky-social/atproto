import { assert, describe, expect, test } from 'vitest'
import { utf8ToBase64Node, utf8ToBase64Ponyfill } from './utf8-to-base64.js'

describe.each([utf8ToBase64Node, utf8ToBase64Ponyfill])('%o', (utf8ToB64) => {
  assert(utf8ToB64)

  describe.each(['base64', 'base64url'] as const)('%s', (encoding) => {
    test.each([
      'Hello, World!',
      '¡Hola, Mundo!',
      'こんにちは世界',
      '😀👩‍💻🌍',
      '',
      '𓀀𓁐𓂀𓃰𓄿𓅱𓆑𓇋𓈖𓉔𓊃𓋴𓌳𓍿𓎛𓏏',
    ])('%s', (text) => {
      const expected = Buffer.from(text, 'utf8')
        .toString(encoding)
        .replaceAll('=', '')
      expect(utf8ToB64(text, encoding)).toBe(expected)
    })
  })
})
