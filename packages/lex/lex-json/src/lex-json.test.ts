import { describe, expect, test } from 'vitest'
import { LexValue, lexEquals, parseCid } from '@atproto/lex-data'
import { JsonValue } from './json.js'
import {
  jsonToLex,
  lexParse,
  lexParseJsonBytes,
  lexStringify,
  lexToJson,
} from './lex-json.js'

export const validVectors: Array<{
  name: string
  json: JsonValue
  lex: LexValue
}> = [
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
]

export const acceptableVectors: Array<{
  note: string
  json: JsonValue
}> = [
  {
    note: 'non string $type',
    json: {
      $type: 3124,
      foo: 'bar',
    },
  },
  {
    note: 'object with float values',
    json: {
      a: 1.5,
    },
  },
  {
    note: 'blob with wrong field type',
    json: {
      $type: 'blob',
      ref: 'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
      mimeType: 'image/jpeg',
      size: 10000,
    },
  },
  {
    note: 'blob with missing key',
    json: {
      $type: 'blob',
      mimeType: 'image/jpeg',
      size: 10000,
    },
  },
  {
    note: 'blob with extra fields',
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
    note: 'bytes with extra fields',
    json: {
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      other: 'blah',
    },
  },
  {
    note: 'link with extra fields',
    json: {
      $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
      other: 'blah',
    },
  },
  {
    note: '$bytes and $link',
    json: {
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
    },
  },
  {
    note: '$bytes and $type',
    json: {
      $type: 'bytes',
      $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
    },
  },
  {
    note: '$link and $type',
    json: {
      $type: 'blob',
      $link: 'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
    },
  },
  {
    note: 'blob with CBOR CID ref',
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
    note: 'object with empty $type',
    json: {
      $type: '',
      foo: 'bar',
    },
  },
]

export const invalidVectors: Array<{
  note: string
  json: JsonValue
}> = [
  {
    note: 'bytes with wrong field type',
    json: {
      $bytes: [1, 2, 3],
    },
  },
  {
    note: 'invalid base64 in $bytes',
    json: {
      $bytes: '🐻',
    },
  },
  {
    note: 'link with wrong field type',
    json: {
      $link: 1234,
    },
  },
  {
    note: 'link with bogus CID',
    json: {
      $link: '.',
    },
  },
]

describe(lexParse, () => {
  describe('valid vectors', () => {
    describe('strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(
            lexEquals(lex, lexParse(JSON.stringify(json), { strict: true })),
          ).toBe(true)
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(
            lexEquals(lex, lexParse(JSON.stringify(json), { strict: false })),
          ).toBe(true)
        })
      }
    })
  })

  describe('acceptable vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: true }),
          ).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })

  describe('invalid vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: true }),
          ).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })
})

describe(lexParseJsonBytes, () => {
  describe('valid vectors', () => {
    describe('strict mode', () => {
      describe('with pretty-printed JSON', () => {
        for (const { name, json, lex } of validVectors) {
          test(name, () => {
            const jsonBytes = Buffer.from(JSON.stringify(json, undefined, 4))
            expect(
              lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: true })),
            ).toBe(true)
          })
        }
      })
      describe('with compact JSON', () => {
        for (const { name, json, lex } of validVectors) {
          test(name, () => {
            const jsonBytes = Buffer.from(JSON.stringify(json))
            expect(
              lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: true })),
            ).toBe(true)
          })
        }
      })
    })

    describe('non-strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(
            lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: false })),
          ).toBe(true)
        })
      }
    })
  })

  describe('acceptable vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() => lexParseJsonBytes(jsonBytes, { strict: true })).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() =>
            lexParseJsonBytes(jsonBytes, { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })

  describe('invalid vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() => lexParseJsonBytes(jsonBytes, { strict: true })).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() =>
            lexParseJsonBytes(jsonBytes, { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })
})

describe(lexStringify, () => {
  describe('valid vectors', () => {
    for (const { name, json, lex } of validVectors) {
      test(name, () => {
        expect(JSON.parse(lexStringify(lex))).toStrictEqual(json)
      })
    }
  })
})

describe(jsonToLex, () => {
  describe('valid vectors', () => {
    describe('strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(lexEquals(jsonToLex(json, { strict: true }), lex)).toBe(true)
          expect(lexEquals(lex, jsonToLex(json, { strict: true }))).toBe(true)
        })
      }
    })

    describe('non-strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(lexEquals(jsonToLex(json, { strict: false }), lex)).toBe(true)
          expect(lexEquals(lex, jsonToLex(json, { strict: false }))).toBe(true)
        })
      }
    })
  })

  describe('acceptable vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: true })).toThrow()
        })
      }
    })

    describe('non-strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: false })).not.toThrow()
        })
      }
    })
  })

  describe('invalid vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: true })).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() => jsonToLex(json, { strict: false })).not.toThrow()
        })
      }
    })
  })
})

describe(lexToJson, () => {
  describe('valid vectors', () => {
    for (const { name, json, lex } of validVectors) {
      test(name, () => {
        expect(lexToJson(lex)).toStrictEqual(json)
      })
    }
  })
})

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
