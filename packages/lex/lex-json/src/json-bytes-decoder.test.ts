import { assert, describe, expect, test } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import {
  BASE64_NATIVE_THRESHOLD,
  JsonBytesDecoder,
} from './json-bytes-decoder.js'

describe('JsonBytesDecoder', () => {
  describe('valid JSON parsing', () => {
    test('parses empty object', () => {
      const json = '{}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses empty array', () => {
      const json = '[]'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses string', () => {
      const json = '"hello"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses number', () => {
      const json = '123'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses true', () => {
      const json = 'true'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses false', () => {
      const json = 'false'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses null', () => {
      const json = 'null'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses object with multiple keys', () => {
      const json = '{"a":1,"b":"test","c":true}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses array with multiple values', () => {
      const json = '[1,"test",true,null]'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses nested structures', () => {
      const json = '{"a":{"b":[1,2,3]},"c":[{"d":4}]}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses object with repeated keys (last value wins, matching JSON.parse)', () => {
      const json = '{"a":1,"b":2,"a":3}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('handles whitespace', () => {
      const json = '  \n\t{"a" : 1 , "b" : 2}  \n'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses short ASCII string (fast path)', () => {
      const json = '"id"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses long ASCII string (TextDecoder path)', () => {
      const json = `"${'a'.repeat(100)}"`
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses UTF-8 string in short string path', () => {
      const json = '"ö"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses UTF-8 string', () => {
      const json = '"😀"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })
  })

  describe('escape sequences', () => {
    test('parses string with escape sequences', () => {
      const json = '"test\\\\\\n\\r\\t\\b\\f\\/"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses escaped double quote', () => {
      const json = '"Say \\"hello\\""'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses escape sequence followed by more text', () => {
      // This covers the case where we have escape + more text + end quote
      const json = '"test\\nmore text here"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses unicode escape', () => {
      const json = '"\\u0041"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses surrogate pair', () => {
      const json = '"\\uD83D\\uDE00"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      const result = decoder.decode()
      expect(result).toStrictEqual(JSON.parse(json))
      assert(result === '😀')
    })

    test('parses multiple unicode escapes', () => {
      const json = '"\\u0048\\u0065\\u006C\\u006C\\u006F"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('handles high surrogate without following low surrogate', () => {
      // High surrogate followed by non-surrogate
      const json = '"\\uD800\\u0041"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      const result = decoder.decode()
      expect(result).toStrictEqual(JSON.parse(json))
      // The exact result depends on JS implementation but should not throw
    })

    test('handles low surrogate without preceding high surrogate', () => {
      // Low surrogate without high surrogate
      const json = '"\\uDC00"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      const result = decoder.decode()
      expect(result).toStrictEqual(JSON.parse(json))
    })

    test('handles high surrogate followed by another high surrogate', () => {
      // Two high surrogates in a row
      const json = '"\\uD800\\uD801"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      const result = decoder.decode()
      expect(result).toStrictEqual(JSON.parse(json))
    })

    test('handles high surrogate at end of string', () => {
      // High surrogate at the very end
      const json = '"test\\uD800"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      const result = decoder.decode()
      expect(result).toStrictEqual(JSON.parse(json))
    })

    test('handles invalid surrogate range', () => {
      // Just before high surrogate range
      const json1 = '"\\uD7FF"'
      const decoder1 = new JsonBytesDecoder(Buffer.from(json1))
      expect(decoder1.decode()).toStrictEqual(JSON.parse(json1))

      // Just after low surrogate range
      const json2 = '"\\uE000"'
      const decoder2 = new JsonBytesDecoder(Buffer.from(json2))
      expect(decoder2.decode()).toStrictEqual(JSON.parse(json2))
    })
  })

  describe('$bytes parsing (small - manual decoding)', () => {
    test('parses small $bytes with manual decoder', () => {
      // 32 bytes base64 = ~24 bytes, well under 256 threshold
      const base64 = 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0='
      expect(base64.length).toBeLessThan(BASE64_NATIVE_THRESHOLD)
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${base64}"}`),
      )
      const result = decoder.decode()
      assert(result instanceof Uint8Array)
    })

    test('parses small $bytes without padding', () => {
      const base64 = 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0'
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${base64}"}`),
      )
      const result = decoder.decode()
      assert(result instanceof Uint8Array)
    })

    test('parses small $bytes with double padding', () => {
      // Test base64 with == padding to cover padding removal loop
      const base64 = 'YWI=='
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${base64}"}`),
      )
      const result = decoder.decode()
      assert(result instanceof Uint8Array)
      expect(result.length).toBe(2)
    })

    test('parses small $bytes with single padding', () => {
      // Test base64 with = padding
      const base64 = 'YWJj='
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${base64}"}`),
      )
      const result = decoder.decode()
      assert(result instanceof Uint8Array)
      expect(result.length).toBe(3)
    })

    test('parses empty $bytes', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":""}'))
      const result = decoder.decode()
      assert(result instanceof Uint8Array)
      expect(result.length).toBe(0)
    })
  })

  describe('$bytes parsing (large - native decoding)', () => {
    test('parses large $bytes with native decoder', () => {
      // Create a base64 string > 256 chars to trigger native path
      const largeData = Buffer.alloc(200).fill(42)
      const base64 = largeData.toString('base64')
      expect(base64.length).toBeGreaterThan(BASE64_NATIVE_THRESHOLD)

      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${base64}"}`),
      )
      const result = decoder.decode()
      assert(result instanceof Uint8Array)
      expect(result.length).toBe(200)
    })
  })

  describe('$link parsing', () => {
    test('parses valid $link', () => {
      const cid = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
      const decoder = new JsonBytesDecoder(Buffer.from(`{"$link":"${cid}"}`))
      const result = decoder.decode()
      expect(result).toStrictEqual(parseCid(cid))
    })
  })

  describe('blob object parsing', () => {
    test('parses valid blob object in strict mode', () => {
      const json = {
        $type: 'blob',
        ref: {
          $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
        },
        mimeType: 'image/jpeg',
        size: 10000,
      }
      const decoder = new JsonBytesDecoder(Buffer.from(JSON.stringify(json)))
      expect(decoder.decode()).toStrictEqual({
        $type: 'blob',
        ref: parseCid(
          'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
        ),
        mimeType: 'image/jpeg',
        size: 10000,
      })
    })
  })

  describe('invalid JSON - syntax errors', () => {
    test('throws on unexpected data after JSON', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{}extra'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid value', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('invalid'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on unterminated string', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('"unterminated'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on unterminated string after escape', () => {
      // String starts with escape but never closes
      const decoder = new JsonBytesDecoder(Buffer.from('"test\\n'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on unescaped control character in string', () => {
      const json = '"test\u0000test"' // Null byte in string
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on control character after escape sequence', () => {
      // Control character in the escape handling path
      const invalidJson = Buffer.from([0x22, 0x5c, 0x6e, 0x00, 0x22]) // "\n\0"
      const decoder = new JsonBytesDecoder(invalidJson)
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(invalidJson.toString())).toThrow()
    })

    test('throws on invalid escape sequence', () => {
      const json = '"test\\x"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid unicode escape', () => {
      const json = '"\\uGGGG"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on truncated unicode escape', () => {
      const json = '"\\u00"'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid number', () => {
      const json = '123.a'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid decimal in non-strict mode', () => {
      const json = '123.'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid number with exponent', () => {
      const json = '123e'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid exponent in non-strict mode', () => {
      const json = '1e'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on unexpected character in number', () => {
      const json = '12x'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid true', () => {
      const json = 'tru'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid false', () => {
      const json = 'fals'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on invalid null', () => {
      const json = 'nul'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on missing object key', () => {
      const json = '{:1}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on missing colon in object', () => {
      const json = '{"a"1}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on missing comma or closing brace', () => {
      const json = '{"a":1"b":2}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on missing comma or closing bracket', () => {
      const json = '[1 2]'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(() => decoder.decode()).toThrow()
      expect(() => JSON.parse(json)).toThrow()
    })

    test('throws on __proto__ key', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"__proto__":1}'))
      expect(() => decoder.decode()).toThrow()
      // @NOTE JSON.parse does not throw on __proto__ key
    })
  })

  describe('invalid JSON - $bytes errors', () => {
    test('throws on unterminated $bytes string', () => {
      // $bytes value without closing quote
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"abc'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid base64 in small $bytes (manual decoder)', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"!!!"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid base64 in large $bytes (native decoder)', () => {
      const invalidBase64 = '!'.repeat(300)
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${invalidBase64}"}`),
      )
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on $bytes with emoji (invalid base64)', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"🐻"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on $bytes with extra fields in strict mode', () => {
      const decoder = new JsonBytesDecoder(
        Buffer.from('{"$bytes":"YWJj","extra":"field"}'),
      )
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid base64 with spaces', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"YWJ j"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid base64 with newline', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"YWJ\\nj"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with invalid character at start', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"@abc"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with invalid character in middle', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"ab@c"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with invalid character at end', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"abc@"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with null byte', () => {
      const invalidBytes = Buffer.from([
        0x7b, 0x22, 0x24, 0x62, 0x79, 0x74, 0x65, 0x73, 0x22, 0x3a, 0x22, 0x59,
        0x57, 0x00, 0x4a, 0x6a, 0x22, 0x7d,
      ]) // {"$bytes":"YW\0Jj"}
      const decoder = new JsonBytesDecoder(invalidBytes)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with control characters', () => {
      const decoder = new JsonBytesDecoder(
        Buffer.from('{"$bytes":"YWJ\\u0001j"}'),
      )
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on large base64 with invalid character (native decoder path)', () => {
      const validBase64 = Buffer.alloc(200).fill(42).toString('base64')
      const invalidBase64 =
        validBase64.substring(0, 100) + '@' + validBase64.substring(101)
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${invalidBase64}"}`),
      )
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on large base64 with emoji (native decoder path)', () => {
      const validBase64 = Buffer.alloc(200).fill(42).toString('base64')
      const invalidBase64 =
        validBase64.substring(0, 100) + '😀' + validBase64.substring(100)
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$bytes":"${invalidBase64}"}`),
      )
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with misplaced padding', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"Y=Jj"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with special characters', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"ab#c"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with brackets', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"ab[c"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on base64 with backslash', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"ab\\\\c"}'))
      expect(() => decoder.decode()).toThrow()
    })
  })

  describe('invalid JSON - $link errors', () => {
    test('throws on unterminated $link string', () => {
      // $link value without closing quote
      const decoder = new JsonBytesDecoder(Buffer.from('{"$link":"bafyrei'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid CID in $link', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$link":"invalid"}'))
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on $link with extra fields in strict mode', () => {
      const cid = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$link":"${cid}","extra":"field"}`),
      )
      expect(() => decoder.decode()).toThrow()
    })
  })

  describe('invalid JSON - blob errors', () => {
    test('throws on invalid blob object in strict mode', () => {
      const decoder = new JsonBytesDecoder(
        Buffer.from('{"$type":"blob","invalid":"field"}'),
      )
      expect(() => decoder.decode()).toThrow()
    })
  })

  describe('invalid JSON - $type errors', () => {
    test('throws on non-string $type in strict mode', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('{"$type":123}'))
      expect(() => decoder.decode()).toThrow()
    })
  })

  describe('non-strict mode', () => {
    test('accepts float in non-strict mode', () => {
      const json = '1.5'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('accepts number with exponent in non-strict mode', () => {
      const json = '1e10'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('accepts negative exponent in non-strict mode', () => {
      const json = '1e-10'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('accepts positive exponent sign in non-strict mode', () => {
      const json = '1e+10'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('accepts $bytes with extra fields in non-strict mode', () => {
      const decoder = new JsonBytesDecoder(
        Buffer.from('{"$bytes":"YWJj","extra":"field"}'),
        false,
      )
      expect(decoder.decode()).toStrictEqual({ $bytes: 'YWJj', extra: 'field' })
    })

    test('accepts $link with extra fields in non-strict mode', () => {
      const cid = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
      const decoder = new JsonBytesDecoder(
        Buffer.from(`{"$link":"${cid}","extra":"field"}`),
        false,
      )
      expect(decoder.decode()).toStrictEqual({ $link: cid, extra: 'field' })
    })

    test('accepts non-string $type in non-strict mode', () => {
      const decoder = new JsonBytesDecoder(
        Buffer.from('{"$type":123,"other":"field"}'),
        false,
      )
      expect(decoder.decode()).toStrictEqual({ $type: 123, other: 'field' })
    })

    test('accepts invalid base64 in $bytes in non-strict mode', () => {
      const decoder = new JsonBytesDecoder(
        Buffer.from('{"$bytes":"!!!"}'),
        false,
      )
      // Should fall back to regular object parsing
      expect(decoder.decode()).toStrictEqual({ $bytes: '!!!' })
    })

    test('accepts invalid CID in $link in non-strict mode', () => {
      const decoder = new JsonBytesDecoder(
        Buffer.from('{"$link":"invalid"}'),
        false,
      )
      // Should fall back to regular object parsing
      expect(decoder.decode()).toStrictEqual({ $link: 'invalid' })
    })
  })

  describe('strict mode - number validation', () => {
    test('accepts safe integer in strict mode', () => {
      const json = '123'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('accepts negative integer in strict mode', () => {
      const json = '-123'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('accepts zero in strict mode', () => {
      const json = '0'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('throws on float in strict mode', () => {
      const decoder = new JsonBytesDecoder(Buffer.from('1.5'))
      expect(() => decoder.decode()).toThrow()
    })

    test('accepts safe integer expressed with exponent in strict mode', () => {
      // 1e10 = 10000000000 which is a safe integer - should NOT throw
      const decoder = new JsonBytesDecoder(Buffer.from('1e10'))
      expect(decoder.decode()).toBe(1e10)
    })

    test('throws on large exponent that produces unsafe integer in strict mode', () => {
      // 1e20 is much larger than MAX_SAFE_INTEGER - should throw
      const decoder = new JsonBytesDecoder(Buffer.from('1e20'))
      expect(() => decoder.decode()).toThrow(TypeError)
    })

    test('throws on unsafe integer in strict mode', () => {
      const unsafeInt = '99999999999999999999'
      const decoder = new JsonBytesDecoder(Buffer.from(unsafeInt))
      expect(() => decoder.decode()).toThrow()
    })
  })

  describe('edge cases', () => {
    test('parses empty string', () => {
      const json = '""'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses object with empty string key and value', () => {
      const json = '{"":"value",  "key":""}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses decimal number at end of input in non-strict mode', () => {
      // Decimal that ends exactly at EOF
      const json = '1.5'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses decimal with multiple digits at EOF in non-strict mode', () => {
      // Decimal with multiple decimal digits ending at EOF
      const json = '123.456789'
      const decoder = new JsonBytesDecoder(Buffer.from(json), false)
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses zero-prefixed number correctly', () => {
      const json = '0'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses negative zero', () => {
      const json = '-0'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses minimum safe integer', () => {
      const json = String(Number.MIN_SAFE_INTEGER)
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses maximum safe integer', () => {
      const json = String(Number.MAX_SAFE_INTEGER)
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses object with only $ keys', () => {
      const json = '{"$custom":"value","$another":"field"}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('parses object with $ key that is not special', () => {
      const json = '{"$custom":"value","normal":"field"}'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })
  })

  describe('whitespace handling', () => {
    test('handles spaces', () => {
      const json = '  {  "a"  :  1  }  '
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('handles tabs', () => {
      const json = '\t{\t"a"\t:\t1\t}\t'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('handles newlines', () => {
      const json = '\n{\n"a"\n:\n1\n}\n'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('handles carriage returns', () => {
      const json = '\r{\r"a"\r:\r1\r}\r'
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })

    test('handles mixed whitespace', () => {
      const json = ' \t\n\r { \t\n\r "a" \t\n\r : \t\n\r 1 \t\n\r } \t\n\r '
      const decoder = new JsonBytesDecoder(Buffer.from(json))
      expect(decoder.decode()).toStrictEqual(JSON.parse(json))
    })
  })

  describe('base64 edge cases', () => {
    test('parses base64 with URL-safe characters (- and _)', () => {
      // URL-safe base64 uses - and _ instead of + and /
      const decoder = new JsonBytesDecoder(Buffer.from('{"$bytes":"YWJj-_0"}'))
      const result = decoder.decode()
      assert(result instanceof Uint8Array)
    })

    test('parses base64 with padding at different positions', () => {
      // Test different padding scenarios
      const decoder1 = new JsonBytesDecoder(Buffer.from('{"$bytes":"YQ=="}'))
      expect(decoder1.decode()).toBeInstanceOf(Uint8Array)

      const decoder2 = new JsonBytesDecoder(Buffer.from('{"$bytes":"YWI="}'))
      expect(decoder2.decode()).toBeInstanceOf(Uint8Array)

      const decoder3 = new JsonBytesDecoder(Buffer.from('{"$bytes":"YWJj"}'))
      expect(decoder3.decode()).toBeInstanceOf(Uint8Array)
    })
  })

  describe('invalid UTF-8 sequences', () => {
    test('throws on invalid UTF-8 in string value', () => {
      // Create invalid UTF-8: 0xFF is not valid in UTF-8
      const invalidUtf8 = Buffer.from([0x22, 0xff, 0x22]) // "�"
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid UTF-8 continuation byte', () => {
      // 0xC2 expects a continuation byte, but 0x20 (space) is not one
      const invalidUtf8 = Buffer.from([0x22, 0xc2, 0x20, 0x22]) // Invalid sequence
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on truncated UTF-8 multi-byte sequence', () => {
      // 0xC2 expects a continuation byte but string ends
      const invalidUtf8 = Buffer.from([0x22, 0xc2, 0x22]) // Truncated 2-byte sequence
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid UTF-8 in object key', () => {
      // Invalid UTF-8 in object key
      const invalidUtf8 = Buffer.from([
        0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d,
      ]) // {"�":1}
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on overlong UTF-8 encoding', () => {
      // Overlong encoding of 'A' (should be 0x41, not 0xC1 0x81)
      const invalidUtf8 = Buffer.from([0x22, 0xc1, 0x81, 0x22])
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid 3-byte UTF-8 sequence', () => {
      // 0xE0 expects 2 continuation bytes
      const invalidUtf8 = Buffer.from([0x22, 0xe0, 0xa0, 0x20, 0x22])
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid 4-byte UTF-8 sequence', () => {
      // 0xF0 expects 3 continuation bytes
      const invalidUtf8 = Buffer.from([0x22, 0xf0, 0x90, 0x80, 0x20, 0x22])
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on UTF-8 surrogate half (0xED 0xA0 0x80)', () => {
      // UTF-8 should not encode surrogates directly
      const invalidUtf8 = Buffer.from([0x22, 0xed, 0xa0, 0x80, 0x22])
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })

    test('throws on invalid UTF-8 in long string (TextDecoder path)', () => {
      // Create a long string with invalid UTF-8 to trigger TextDecoder path
      const prefix = Buffer.from('"' + 'a'.repeat(25))
      const invalidByte = Buffer.from([0xff])
      const suffix = Buffer.from('"')
      const invalidUtf8 = Buffer.concat([prefix, invalidByte, suffix])
      const decoder = new JsonBytesDecoder(invalidUtf8)
      expect(() => decoder.decode()).toThrow()
    })
  })
})
