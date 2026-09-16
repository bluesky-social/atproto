import { assert, describe, expect, it } from 'vitest'
import { lexParse, lexParseJsonBytes } from './lex-parse.js'

describe(lexParse, () => {
  describe('depth limits', () => {
    it('supports very deeply nested structures', () => {
      const depth = 20000
      const input = '['.repeat(depth) + ']'.repeat(depth)
      let result = lexParse(input, { maxNestedLevels: depth })
      for (let i = 0; i < depth; i++) {
        assert(Array.isArray(result))
        result = result[0]
      }
    })

    it('allows deeply nested structures in non-strict mode', () => {
      const depth = 2000
      const input = '['.repeat(depth) + ']'.repeat(depth)
      let result = lexParse(input, { strict: false })
      for (let i = 0; i < depth; i++) {
        assert(Array.isArray(result))
        result = result[0]
      }
    })

    it('enforces depth limit in strict mode', () => {
      const depth = 2000
      const input = '['.repeat(depth) + ']'.repeat(depth)
      expect(() => lexParse(input, { strict: true })).toThrow(
        'Input is too deeply nested',
      )
    })

    it('enforces default limit (5000) in non-strict mode by default', () => {
      // Default is strict: false with maxNestedLevels: 5000
      // With the check being `parent.frame.depth >= maxNestedLevels`,
      // maxNestedLevels: 5000 allows depths 0-5000, meaning 5001 nested arrays work
      const validDepth = '['.repeat(5001) + ']'.repeat(5001)
      let result = lexParse(validDepth)
      for (let i = 0; i < 5001; i++) {
        assert(Array.isArray(result))
        result = result[0]
      }

      // Depth 5001 (5002 nested arrays) should throw
      const tooDeep = '['.repeat(5002) + ']'.repeat(5002)
      expect(() => lexParse(tooDeep)).toThrow('Input is too deeply nested')
    })
  })
})

describe('deeply nested structures', () => {
  describe('lexParse handles deep nesting without recursion errors', () => {
    it('parse deeply nested arrays (4000 levels)', () => {
      // Generate JSON manually using string repetition to avoid recursion
      const jsonString = '['.repeat(4000) + '1' + ']'.repeat(4000)

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexParse(jsonString)).not.toThrow()

      const parsed = lexParse(jsonString)
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('parse deeply nested objects (4000 levels)', () => {
      // Generate JSON manually using string repetition to avoid recursion
      const jsonString = '{"a":'.repeat(4000) + '42' + '}'.repeat(4000)

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexParse(jsonString)).not.toThrow()

      const parsed = lexParse(jsonString)
      expect(typeof parsed).toBe('object')
    })
  })
})

describe('lexParseJsonBytes strict mode error parity with lexParse', () => {
  describe('invalid JSON input throws SyntaxError containing "Unexpected token"', () => {
    it('lexParse throws with Unexpected token', () => {
      expect(() => lexParse('not valid json', { strict: true })).toThrow(
        /Unexpected token/,
      )
    })

    it('lexParseJsonBytes throws with Unexpected token', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from('not valid json'), { strict: true }),
      ).toThrow(/Unexpected token/)
    })

    it('lexParseJsonBytes non-strict also throws with Unexpected token for invalid JSON', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from('not valid json'), { strict: false }),
      ).toThrow(/Unexpected token/)
    })
  })

  describe('float numbers: strict throws TypeError, non-strict accepts', () => {
    const jsonStr = '{"value":1.5}'

    it('lexParse strict throws TypeError with value in message', () => {
      expect(() => lexParse(jsonStr, { strict: true })).toThrow(TypeError)
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(jsonStr)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
    })

    it('lexParse non-strict accepts float', () => {
      expect(() => lexParse(jsonStr, { strict: false })).not.toThrow()
    })

    it('lexParseJsonBytes non-strict accepts float', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(jsonStr), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('exponent notation: safe integers accepted, unsafe integers rejected', () => {
    it('lexParse strict accepts 1e10 (safe integer)', () => {
      expect(lexParse('1e10', { strict: true })).toBe(1e10)
    })

    it('lexParseJsonBytes strict accepts 1e10 (safe integer)', () => {
      expect(lexParseJsonBytes(Buffer.from('1e10'), { strict: true })).toBe(
        1e10,
      )
    })

    it('lexParse strict rejects 1e20 (unsafe integer)', () => {
      expect(() => lexParse('1e20', { strict: true })).toThrow(TypeError)
    })

    it('lexParseJsonBytes strict rejects 1e20 (unsafe integer)', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from('1e20'), { strict: true }),
      ).toThrow(TypeError)
    })
  })

  describe('invalid blob: strict throws TypeError, non-strict returns plain object', () => {
    const invalidBlobJson = '{"$type":"blob"}'

    it('lexParse strict throws TypeError with "Invalid blob object"', () => {
      expect(() => lexParse(invalidBlobJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(invalidBlobJson, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(invalidBlobJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(invalidBlobJson, { strict: false })).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
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

    it('lexParse strict throws TypeError with "Invalid blob object"', () => {
      expect(() => lexParse(blobWithCborCidJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(blobWithCborCidJson, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(blobWithCborCidJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid blob object',
      )
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() =>
        lexParse(blobWithCborCidJson, { strict: false }),
      ).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(blobWithCborCidJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('invalid $link: strict throws TypeError, non-strict returns plain object', () => {
    const invalidLinkJson = '{"$link":"."}'

    it('lexParse strict throws TypeError with "Invalid $link object"', () => {
      expect(() => lexParse(invalidLinkJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(invalidLinkJson, { strict: true })).toThrow(
        'Invalid $link object',
      )
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(invalidLinkJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow(
        'Invalid $link object',
      )
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(invalidLinkJson, { strict: false })).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(invalidLinkJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('$link with extra fields: strict throws TypeError, non-strict returns plain object', () => {
    const linkWithExtraJson =
      '{"$link":"bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity","extra":"field"}'

    it('lexParse strict throws TypeError with "Invalid $link object"', () => {
      expect(() => lexParse(linkWithExtraJson, { strict: true })).toThrow(
        TypeError,
      )
      expect(() => lexParse(linkWithExtraJson, { strict: true })).toThrow(
        'Invalid $link object',
      )
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(linkWithExtraJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow()
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(linkWithExtraJson, { strict: false })).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(linkWithExtraJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('invalid $bytes: strict throws TypeError, non-strict returns plain object', () => {
    const invalidBytesJson = '{"$bytes":"🐻"}'

    it('lexParse strict throws TypeError with "Invalid $bytes object"', () => {
      expect(() => lexParse(invalidBytesJson, { strict: true })).toThrow()
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(invalidBytesJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow()
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(invalidBytesJson, { strict: false })).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(invalidBytesJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('$bytes with extra fields: strict throws TypeError, non-strict returns plain object', () => {
    const bytesWithExtraJson =
      '{"$bytes":"nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0","extra":"field"}'

    it('lexParse strict throws TypeError with "Invalid $bytes object"', () => {
      expect(() => lexParse(bytesWithExtraJson, { strict: true })).toThrow()
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(bytesWithExtraJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow()
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() =>
        lexParse(bytesWithExtraJson, { strict: false }),
      ).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(bytesWithExtraJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('empty $type: strict throws TypeError, non-strict returns plain object', () => {
    const emptyTypeJson = '{"$type":"","foo":"bar"}'

    it('lexParse strict throws TypeError with "Empty $type property"', () => {
      expect(() => lexParse(emptyTypeJson, { strict: true })).toThrow()
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(emptyTypeJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow()
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(emptyTypeJson, { strict: false })).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(emptyTypeJson), { strict: false }),
      ).not.toThrow()
    })
  })

  describe('non-string $type: strict throws, non-strict returns plain object', () => {
    const nonStringTypeJson = '{"$type":123,"foo":"bar"}'

    it('lexParse strict throws TypeError with type name in message', () => {
      expect(() => lexParse(nonStringTypeJson, { strict: true })).toThrow()
    })

    it('lexParseJsonBytes strict throws same TypeError', () => {
      const bytes = Buffer.from(nonStringTypeJson)
      expect(() => lexParseJsonBytes(bytes, { strict: true })).toThrow()
    })

    it('lexParse non-strict returns plain object', () => {
      expect(() => lexParse(nonStringTypeJson, { strict: false })).not.toThrow()
    })

    it('lexParseJsonBytes non-strict returns plain object', () => {
      expect(() =>
        lexParseJsonBytes(Buffer.from(nonStringTypeJson), { strict: false }),
      ).not.toThrow()
    })
  })
})
