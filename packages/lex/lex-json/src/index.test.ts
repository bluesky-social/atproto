import { describe, expect, test } from 'vitest'
import { lexEquals, parseCid } from '@atproto/lex-data'
import { validVectors } from './fixtures.test.js'
import {
  jsonToLex,
  lexParse,
  lexParseJsonBytes,
  lexStringify,
  lexToJson,
} from './index.js'

describe('json > lex > json', () => {
  describe('valid vectors', () => {
    for (const { name, json } of validVectors) {
      test(name, () => {
        expect(lexToJson(jsonToLex(json))).toStrictEqual(json)
      })
    }
  })
})

describe('json (binary) > lex > json', () => {
  describe('valid vectors', () => {
    for (const { name, json } of validVectors) {
      test(name, () => {
        const jsonBytes = Buffer.from(JSON.stringify(json, undefined, 4))
        expect(lexToJson(lexParseJsonBytes(jsonBytes))).toStrictEqual(json)
      })
    }
  })
})

describe('lex > json > lex', () => {
  describe('valid vectors', () => {
    for (const { name, lex } of validVectors) {
      test(name, () => {
        expect(lexEquals(jsonToLex(lexToJson(lex)), lex)).toBe(true)
        expect(lexEquals(lex, jsonToLex(lexToJson(lex)))).toBe(true)
      })
    }
  })
})

describe('lexParseJsonBytes strict mode error parity with lexParse', () => {
  describe('invalid JSON input throws SyntaxError containing "Unexpected token"', () => {
    test('lexParse throws with Unexpected token', () => {
      expect(() => lexParse('not valid json', { strict: true })).toThrow(
        /Unexpected token/,
      )
    })

    test('lexParseJsonBytes throws with Unexpected token', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from('not valid json'), { strict: true }),
      ).toThrow(/Unexpected token/)
    })

    test('lexParseJsonBytes non-strict also throws with Unexpected token for invalid JSON', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from('not valid json'), { strict: false }),
      ).toThrow(/Unexpected token/)
    })
  })

  describe('float numbers: strict throws TypeError, non-strict accepts', () => {
    const jsonStr = '{"value":1.5}'

    test('lexParse strict throws TypeError with value in message', () => {
      expect(() => lexParse(jsonStr, { strict: true })).toThrow(TypeError)
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(jsonStr)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
    })

    test('lexParse non-strict accepts float', () => {
      expect(() => lexParse(jsonStr, { strict: false })).not.toThrow()
    })

    test('lexParseJsonBytes non-strict accepts float', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(jsonStr), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('exponent notation: safe integers accepted, unsafe integers rejected', () => {
    test('lexParse strict accepts 1e10 (safe integer)', () => {
      expect(lexParse('1e10', { strict: true })).toBe(1e10)
    })

    test('lexParseJsonBytes strict accepts 1e10 (safe integer)', () => {
      expect(lexParseJsonBytes(Buffer.from('1e10'), { strict: true })).toBe(
        1e10,
      )
    })

    test('lexParse strict rejects 1e20 (unsafe integer)', () => {
      expect(() => lexParse('1e20', { strict: true })).toThrow(TypeError)
    })

    test('lexParseJsonBytes strict rejects 1e20 (unsafe integer)', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from('1e20'), { strict: true }),
      ).toThrow(TypeError)
    })
  })

  describe('invalid blob: strict throws TypeError, non-strict returns plain object', () => {
    const invalidBlobJson = '{"$type":"blob"}'

    test('lexParse strict throws TypeError with "Invalid blob object"', () => {
      expect(() => lexParse(invalidBlobJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(invalidBlobJson, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(invalidBlobJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(invalidBlobJson, { strict: false })).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(invalidBlobJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('blob with CBOR CID: strict throws TypeError, non-strict returns plain object', () => {
    const blobWithCborCidJson = JSON.stringify({
      $type: 'blob',
      ref: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      mimeType: 'image/png',
      size: 1,
    })

    test('lexParse strict throws TypeError with "Invalid blob object"', () => {
      expect(() => lexParse(blobWithCborCidJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(blobWithCborCidJson, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(blobWithCborCidJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() =>
        lexParse(blobWithCborCidJson, { strict: false }),
      ).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(blobWithCborCidJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('invalid $link: strict throws TypeError, non-strict returns plain object', () => {
    const invalidLinkJson = '{"$link":"."}'

    test('lexParse strict throws TypeError with "Invalid $link object"', () => {
      expect(() => lexParse(invalidLinkJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(invalidLinkJson, { strict: true })).toThrow(
        'Invalid $link object',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(invalidLinkJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid $link object',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(invalidLinkJson, { strict: false })).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(invalidLinkJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('$link with extra fields: strict throws TypeError, non-strict returns plain object', () => {
    const linkWithExtraJson =
      '{"$link":"bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity","extra":"field"}'

    test('lexParse strict throws TypeError with "Invalid $link object"', () => {
      expect(() => lexParse(linkWithExtraJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(linkWithExtraJson, { strict: true })).toThrow(
        'Invalid $link object',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(linkWithExtraJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid $link object',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(linkWithExtraJson, { strict: false })).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(linkWithExtraJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('invalid $bytes: strict throws TypeError, non-strict returns plain object', () => {
    const invalidBytesJson = '{"$bytes":"🐻"}'

    test('lexParse strict throws TypeError with "Invalid $bytes object"', () => {
      expect(() => lexParse(invalidBytesJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(invalidBytesJson, { strict: true })).toThrow(
        'Invalid $bytes object',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(invalidBytesJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid $bytes object',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(invalidBytesJson, { strict: false })).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(invalidBytesJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('$bytes with extra fields: strict throws TypeError, non-strict returns plain object', () => {
    const bytesWithExtraJson =
      '{"$bytes":"nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0","extra":"field"}'

    test('lexParse strict throws TypeError with "Invalid $bytes object"', () => {
      expect(() => lexParse(bytesWithExtraJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(bytesWithExtraJson, { strict: true })).toThrow(
        'Invalid $bytes object',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(bytesWithExtraJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid $bytes object',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() =>
        lexParse(bytesWithExtraJson, { strict: false }),
      ).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(bytesWithExtraJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('empty $type: strict throws TypeError, non-strict returns plain object', () => {
    const emptyTypeJson = '{"$type":"","foo":"bar"}'

    test('lexParse strict throws TypeError with "Empty $type property"', () => {
      expect(() => lexParse(emptyTypeJson, { strict: true })).toThrow(TypeError)
      expect(() => lexParse(emptyTypeJson, { strict: true })).toThrow(
        'Empty $type property',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(emptyTypeJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Empty $type property',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(emptyTypeJson, { strict: false })).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(emptyTypeJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('non-string $type: strict throws TypeError, non-strict returns plain object', () => {
    const nonStringTypeJson = '{"$type":123,"foo":"bar"}'

    test('lexParse strict throws TypeError with type name in message', () => {
      expect(() => lexParse(nonStringTypeJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(nonStringTypeJson, { strict: true })).toThrow(
        'Invalid $type property (number)',
      )
    })

    test('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(nonStringTypeJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid $type property (number)',
      )
    })

    test('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(nonStringTypeJson, { strict: false })).not.toThrow()
    })

    test('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(nonStringTypeJson), { strict: false }),
      ).not.toThrow()
    })
  })
})

describe('deeply nested structures', () => {
  describe('lexStringify handles deep nesting without recursion errors', () => {
    test('stringify deeply nested objects (4000 levels)', () => {
      // Create a deeply nested structure using iteration to avoid recursion
      let deepData: any = {
        value: 'leaf',
        cid: parseCid(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
        bytes: new Uint8Array([1, 2, 3, 4, 5]),
      }

      for (let i = 0; i < 4000; i++) {
        deepData = { nested: deepData }
      }

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexStringify(deepData)).not.toThrow()

      const jsonString = lexStringify(deepData)
      expect(jsonString.startsWith('{"nested":')).toBe(true)
      expect(jsonString.length).toBeGreaterThan(40000)
    })

    test('stringify deeply nested arrays (4000 levels)', () => {
      // Create a deeply nested array structure using iteration
      let deepData: any = [
        'leaf',
        parseCid('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
        new Uint8Array([1, 2, 3]),
      ]

      for (let i = 0; i < 4000; i++) {
        deepData = [deepData]
      }

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexStringify(deepData)).not.toThrow()

      const jsonString = lexStringify(deepData)
      expect(jsonString.startsWith('[[[')).toBe(true)
    })

    test('lexStringify output matches JSON.stringify(lexToJson(input))', () => {
      const testData = {
        string: 'test',
        number: 42,
        bool: true,
        null: null,
        cid: parseCid(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
        bytes: new Uint8Array([10, 20, 30]),
        nested: {
          array: [
            1,
            2,
            parseCid(
              'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
            ),
          ],
        },
      }

      const result1 = lexStringify(testData)
      const result2 = JSON.stringify(lexToJson(testData))

      expect(JSON.parse(result1)).toStrictEqual(JSON.parse(result2))
    })
  })

  describe('lexParse handles deep nesting without recursion errors', () => {
    test('parse deeply nested arrays (4000 levels)', () => {
      // Generate JSON manually using string repetition to avoid recursion
      const jsonString = '['.repeat(4000) + '1' + ']'.repeat(4000)

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexParse(jsonString)).not.toThrow()

      const parsed = lexParse(jsonString)
      expect(Array.isArray(parsed)).toBe(true)
    })

    test('parse deeply nested objects (4000 levels)', () => {
      // Generate JSON manually using string repetition to avoid recursion
      const jsonString = '{"a":'.repeat(4000) + '42' + '}'.repeat(4000)

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexParse(jsonString)).not.toThrow()

      const parsed = lexParse(jsonString)
      expect(typeof parsed).toBe('object')
    })
  })

  describe('round-trip deeply nested structures', () => {
    test('stringify and parse deeply nested structure with special types', () => {
      // Create a moderately deep structure (500 levels) with special types
      let deepData: any = {
        leaf: 'value',
        cid: parseCid(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
        bytes: new Uint8Array([100, 101, 102]),
      }

      for (let i = 0; i < 500; i++) {
        deepData = {
          level: i,
          nested: deepData,
          extraCid: parseCid(
            'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
          ),
        }
      }

      const jsonString = lexStringify(deepData)
      const parsed = lexParse(jsonString, { strict: false })

      // Navigate to the leaf level using iteration
      let current: any = parsed
      for (let i = 499; i >= 0; i--) {
        expect(current.level).toBe(i)
        expect(current.extraCid).toBeInstanceOf(Object)
        current = current.nested
      }

      expect(current.leaf).toBe('value')
      expect(current.cid).toBeInstanceOf(Object)
      expect(current.bytes).toBeInstanceOf(Uint8Array)
      expect(Array.from(current.bytes)).toStrictEqual([100, 101, 102])
    })
  })
})
