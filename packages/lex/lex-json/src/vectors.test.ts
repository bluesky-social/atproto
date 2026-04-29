import { describe, expect, it, test } from 'vitest'
import { LexValue, lexEquals, parseCid } from '@atproto/lex-data'
import { jsonToLex } from './json-to-lex.js'
import { JsonValue } from './json.js'
import { lexParse, lexParseJsonBytes } from './lex-parse.js'
import { lexStringify } from './lex-stringify.js'
import { lexToJson } from './lex-to-json.js'

// This file defined test vectors used across multiple test suites. It also
// contains some cross-cutting tests that validate the consistency of the
// various transformations between JSON and Lex formats, ensuring that the
// round-trip conversions work as expected.

describe.each<{
  name: string
  json: JsonValue
  lex: LexValue
}>([
  {
    name: 'pure json',
    json: {
      string: 'abc',
      unicode: 'a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧',
      integer: 123,
      bool: true,
      null: null,
      array: ['abc', 'def', 'ghi'],
      object: {
        string: 'abc',
        number: 123,
        bool: true,
        arr: ['abc', 'def', 'ghi'],
      },
    },
    lex: {
      string: 'abc',
      unicode: 'a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧',
      integer: 123,
      bool: true,
      null: null,
      array: ['abc', 'def', 'ghi'],
      object: {
        string: 'abc',
        number: 123,
        bool: true,
        arr: ['abc', 'def', 'ghi'],
      },
    },
  },
  {
    name: 'lex data',
    json: {
      a: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      b: {
        $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      },
      c: {
        $type: 'blob',
        ref: {
          $link: 'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
        },
        mimeType: 'image/jpeg',
        size: 10000,
      },
    },
    lex: {
      a: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
      b: new Uint8Array([
        156, 81, 17, 142, 242, 203, 139, 15, 106, 155, 142, 73, 174, 161, 253,
        65, 60, 242, 11, 98, 238, 213, 118, 248, 157, 238, 190, 176, 26, 194,
        204, 141,
      ]),
      c: {
        $type: 'blob',
        ref: parseCid(
          'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
        ),
        mimeType: 'image/jpeg',
        size: 10000,
      },
    },
  },
  {
    name: 'lexArray',
    json: [
      {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      {
        $link: 'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
      },
      {
        $link: 'bafyreiaizynclnqiolq7byfpjjtgqzn4sfrsgn7z2hhf6bo4utdwkin7ke',
      },
      {
        $link: 'bafyreifd4w4tcr5tluxz7osjtnofffvtsmgdqcfrfi6evjde4pl27lrjpy',
      },
    ],
    lex: [
      parseCid('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
      parseCid('bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q'),
      parseCid('bafyreiaizynclnqiolq7byfpjjtgqzn4sfrsgn7z2hhf6bo4utdwkin7ke'),
      parseCid('bafyreifd4w4tcr5tluxz7osjtnofffvtsmgdqcfrfi6evjde4pl27lrjpy'),
    ],
  },
  {
    name: 'root cid',
    json: {
      $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    },
    lex: parseCid(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    ),
  },
  {
    name: 'root bytes',
    json: {
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
    },
    lex: new Uint8Array([
      156, 81, 17, 142, 242, 203, 139, 15, 106, 155, 142, 73, 174, 161, 253, 65,
      60, 242, 11, 98, 238, 213, 118, 248, 157, 238, 190, 176, 26, 194, 204,
      141,
    ]),
  },
  {
    name: 'lexNested',
    json: {
      a: {
        b: [
          {
            d: [
              {
                $link:
                  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              },
              {
                $link:
                  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              },
            ],
            e: [
              {
                $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
              },
              {
                $bytes: 'iE+sPoHobU9tSIqGI+309LLCcWQIRmEXwxcoDt19tas',
              },
            ],
          },
        ],
      },
    },
    lex: {
      a: {
        b: [
          {
            d: [
              parseCid(
                'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              ),
              parseCid(
                'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              ),
            ],
            e: [
              new Uint8Array([
                156, 81, 17, 142, 242, 203, 139, 15, 106, 155, 142, 73, 174,
                161, 253, 65, 60, 242, 11, 98, 238, 213, 118, 248, 157, 238,
                190, 176, 26, 194, 204, 141,
              ]),
              new Uint8Array([
                136, 79, 172, 62, 129, 232, 109, 79, 109, 72, 138, 134, 35, 237,
                244, 244, 178, 194, 113, 100, 8, 70, 97, 23, 195, 23, 40, 14,
                221, 125, 181, 171,
              ]),
            ],
          },
        ],
      },
    },
  },
  {
    name: 'empty structures',
    json: {
      emptyObject: {},
      emptyArray: [],
      emtyBytes: { $bytes: '' },
    },
    lex: {
      emptyObject: {},
      emptyArray: [],
      emtyBytes: new Uint8Array([]),
    },
  },
  {
    name: 'mixed types in array',
    json: {
      arr: [
        'string',
        123,
        true,
        null,
        {
          $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        },
        { $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0' },
        { nested: 'object' },
        ['nested', 'array'],
      ],
    },
    lex: {
      arr: [
        'string',
        123,
        true,
        null,
        parseCid('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
        new Uint8Array([
          156, 81, 17, 142, 242, 203, 139, 15, 106, 155, 142, 73, 174, 161, 253,
          65, 60, 242, 11, 98, 238, 213, 118, 248, 157, 238, 190, 176, 26, 194,
          204, 141,
        ]),
        { nested: 'object' },
        ['nested', 'array'],
      ],
    },
  },
  {
    name: "mismatched order in object doesn't affect equality",
    json: {
      a: 'valueA',
      b: 'valueB',
      c: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      d: {
        a: 'valueA',
        b: 'valueB',
      },
    },
    lex: {
      c: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
      d: {
        b: 'valueB',
        a: 'valueA',
      },
      a: 'valueA',
      b: 'valueB',
    },
  },
])('valid: $name', ({ json, lex }) => {
  describe(lexParse, () => {
    it('should parse JSON to LexValue', () => {
      const parseResult = lexParse(JSON.stringify(json))
      expect(lexEquals(parseResult, lex)).toBe(true)
    })

    it('should parse JSON to LexValue in strict mode', () => {
      expect(
        lexEquals(lex, lexParse(JSON.stringify(json), { strict: true })),
      ).toBe(true)
    })

    it('should parse JSON to LexValue in non-strict mode', () => {
      expect(
        lexEquals(lex, lexParse(JSON.stringify(json), { strict: false })),
      ).toBe(true)
    })
  })

  describe(lexParseJsonBytes, () => {
    it('should parse JSON bytes to LexValue', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json, undefined, 4))
      expect(
        lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: true })),
      ).toBe(true)
    })

    it('should parse JSON bytes to LexValue in non-strict mode', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json))
      expect(
        lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: true })),
      ).toBe(true)
    })

    it('should parse JSON bytes to LexValue in non-strict mode', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json))
      expect(
        lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: false })),
      ).toBe(true)
    })
  })

  describe(jsonToLex, () => {
    it('should convert JSON to LexValue in strict mode', () => {
      expect(lexEquals(jsonToLex(json, { strict: true }), lex)).toBe(true)
      expect(lexEquals(lex, jsonToLex(json, { strict: true }))).toBe(true)
    })

    it('should convert JSON to LexValue in non-strict mode', () => {
      expect(lexEquals(jsonToLex(json, { strict: false }), lex)).toBe(true)
      expect(lexEquals(lex, jsonToLex(json, { strict: false }))).toBe(true)
    })
  })

  describe(lexToJson, () => {
    it('should convert LexValue to JSON', () => {
      expect(lexToJson(lex)).toStrictEqual(json)
    })
  })

  describe(lexEquals, () => {
    it('should consider json equal to itself', () => {
      expect(lexEquals(json, structuredClone(json))).toBe(true)
      expect(lexEquals(structuredClone(json), json)).toBe(true)
    })
  })

  describe(lexStringify, () => {
    it('should stringify LexValue to JSON string', () => {
      const stringifyResult = lexStringify(lex)
      const composeResult = JSON.stringify(json)

      // Both should parse to the similar value (ignoring whitespace
      // differences, object key order, etc.)
      expect(JSON.parse(stringifyResult)).toStrictEqual(
        JSON.parse(composeResult),
      )
    })
  })

  describe('round-trip transformations', () => {
    test('JsonValue > JSON (string) > LexValue > JsonValue', () => {
      const jsonString = JSON.stringify(json, undefined, 4)
      expect(lexToJson(lexParse(jsonString))).toStrictEqual(json)
    })

    test('JsonValue > JSON (string) > JSON (binary) > LexValue > JsonValue', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json, undefined, 4))
      expect(lexToJson(lexParseJsonBytes(jsonBytes))).toStrictEqual(json)
    })

    test('LexValue > JsonValue > LexValue', () => {
      expect(lexEquals(jsonToLex(lexToJson(lex)), lex)).toBe(true)
      expect(lexEquals(lex, jsonToLex(lexToJson(lex)))).toBe(true)
    })
  })
})

describe.each<{
  name: string
  json: JsonValue
}>([
  {
    name: 'non string $type',
    json: {
      $type: 3124,
      foo: 'bar',
    },
  },
  {
    name: 'object with float values',
    json: {
      a: 1.5,
    },
  },
  {
    name: 'blob with wrong field type',
    json: {
      $type: 'blob',
      ref: 'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
      mimeType: 'image/jpeg',
      size: 10000,
    },
  },
  {
    name: 'blob with missing key',
    json: {
      $type: 'blob',
      mimeType: 'image/jpeg',
      size: 10000,
    },
  },
  {
    name: 'blob with extra fields',
    json: {
      $type: 'blob',
      ref: {
        $link: 'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
      },
      mimeType: 'image/jpeg',
      size: 10000,
      other: 'blah',
    },
  },
  {
    name: 'bytes with extra fields',
    json: {
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      other: 'blah',
    },
  },
  {
    name: 'link with extra fields',
    json: {
      $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
      other: 'blah',
    },
  },
  {
    name: '$bytes and $link',
    json: {
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
    },
  },
  {
    name: '$bytes and $type',
    json: {
      $type: 'bytes',
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
    },
  },
  {
    name: '$link and $type',
    json: {
      $type: 'blob',
      $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
    },
  },
  {
    name: 'blob with CBOR CID ref',
    json: {
      $type: 'blob',
      ref: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      mimeType: 'image/png',
      size: 1,
    },
  },
  {
    name: 'object with empty $type',
    json: {
      $type: '',
      foo: 'bar',
    },
  },
])('acceptable: $name', ({ json }) => {
  describe(lexParse, () => {
    it('should throw in strict mode', () => {
      expect(() => lexParse(JSON.stringify(json), { strict: true })).toThrow()
    })

    it('should not throw in non-strict mode', () => {
      expect(() =>
        lexParse(JSON.stringify(json), { strict: false }),
      ).not.toThrow()
    })
  })

  describe(lexParseJsonBytes, () => {
    it('should throw in strict mode', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json))
      expect(() => lexParseJsonBytes(jsonBytes, { strict: true })).toThrow()
    })

    it('should not throw in non-strict mode', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json))
      expect(() =>
        lexParseJsonBytes(jsonBytes, { strict: false }),
      ).not.toThrow()
    })
  })

  describe(jsonToLex, () => {
    it('should throw in strict mode', () => {
      expect(() => jsonToLex(json, { strict: true })).toThrow()
    })

    it('should not throw in non-strict mode', () => {
      expect(() => jsonToLex(json, { strict: false })).not.toThrow()
    })
  })

  describe(lexStringify, () => {
    it('should not throw', () => {
      expect(() =>
        lexStringify(jsonToLex(json, { strict: false })),
      ).not.toThrow()
    })
  })

  describe('round-trip consistency', () => {
    test('JsonValue > LexValue > JsonValue', () => {
      expect(lexToJson(jsonToLex(json))).toStrictEqual(json)
    })
  })
})

describe.each<{
  name: string
  json: JsonValue
}>([
  {
    name: 'bytes with wrong field type',
    json: {
      $bytes: [1, 2, 3],
    },
  },
  {
    name: 'invalid base64 in $bytes',
    json: {
      $bytes: '🐻',
    },
  },
  {
    name: 'link with wrong field type',
    json: {
      $link: 1234,
    },
  },
  {
    name: 'link with bogus CID',
    json: {
      $link: '.',
    },
  },
])('invalid: $name', ({ json }) => {
  describe(lexParse, () => {
    it('should throw in strict mode', () => {
      expect(() => lexParse(JSON.stringify(json), { strict: true })).toThrow()
    })

    it('should throw in non-strict mode', () => {
      expect(() =>
        lexParse(JSON.stringify(json), { strict: false }),
      ).not.toThrow()
    })
  })

  describe(lexParseJsonBytes, () => {
    it('should throw in strict mode', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json))
      expect(() => lexParseJsonBytes(jsonBytes, { strict: true })).toThrow()
    })

    it('should not throw in non-strict mode', () => {
      const jsonBytes = Buffer.from(JSON.stringify(json))
      expect(() =>
        lexParseJsonBytes(jsonBytes, { strict: false }),
      ).not.toThrow()
    })
  })

  describe(jsonToLex, () => {
    it('should throw in strict mode', () => {
      expect(() => jsonToLex(json, { strict: true })).toThrow()
    })

    it('should not throw in non-strict mode', () => {
      expect(() => jsonToLex(json, { strict: false })).not.toThrow()
    })
  })
})
