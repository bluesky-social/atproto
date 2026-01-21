import { describe, expect, it } from 'vitest'
import { LexValue, lexEquals, parseCid } from '@atproto/lex-data'
import { JsonValue } from './json.js'
import { jsonToLex, lexParse, lexStringify, lexToJson } from './lex-json.js'

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

describe('lexParse', () => {
  describe('valid vectors', () => {
    for (const { name, json, lex } of validVectors) {
      describe(name, () => {
        it('parses lex from string', () => {
          expect(
            lexEquals(lex, lexParse(JSON.stringify(json), { strict: false })),
          ).toBe(true)
          expect(
            lexEquals(lex, lexParse(JSON.stringify(json), { strict: true })),
          ).toBe(true)
        })
      })
    }
  })

  describe('acceptable vectors', () => {
    for (const { note, json } of acceptableVectors) {
      describe(note, () => {
        it('parses lex from string in non-strict mode', () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: false }),
          ).not.toThrow()
        })

        it('parses lex from string in strict mode', () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: true }),
          ).toThrow()
        })
      })
    }
  })

  describe('invalid vectors', () => {
    for (const { note, json } of invalidVectors) {
      describe(note, () => {
        it('throws when parsing malformed JSON', () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: false }),
          ).toThrow()
          expect(() =>
            lexParse(JSON.stringify(json), { strict: true }),
          ).toThrow()
        })
      })
    }
  })
})

describe('lexStringify', () => {
  describe('valid vectors', () => {
    for (const { name, json, lex } of validVectors) {
      describe(name, () => {
        it('stringifies lex to string', () => {
          expect(JSON.parse(lexStringify(lex))).toEqual(json)
        })
      })
    }
  })
})

describe('jsonToLex', () => {
  describe('valid vectors', () => {
    for (const { name, json, lex } of validVectors) {
      describe(name, () => {
        it('converts json to lex (in strict mode)', () => {
          expect(lexEquals(jsonToLex(json, { strict: true }), lex)).toBe(true)
          expect(lexEquals(lex, jsonToLex(json, { strict: true }))).toBe(true)
        })

        it('converts json to lex (in non-strict mode)', () => {
          expect(lexEquals(jsonToLex(json, { strict: false }), lex)).toBe(true)
          expect(lexEquals(lex, jsonToLex(json, { strict: false }))).toBe(true)
        })
      })
    }
  })

  describe('acceptable vectors', () => {
    for (const { note, json } of acceptableVectors) {
      describe(note, () => {
        it('parses lex from json in strict mode', () => {
          expect(() => jsonToLex(json, { strict: true })).toThrow()
        })

        it('parses lex from json in non-strict mode', () => {
          expect(() => jsonToLex(json, { strict: false })).not.toThrow()
        })
      })
    }
  })

  describe('invalid vectors', () => {
    for (const { note, json } of invalidVectors) {
      describe(note, () => {
        it(`throws for malformed object`, () => {
          expect(() => jsonToLex(json, { strict: true })).toThrow()
        })

        it('throws for nested malformed object', () => {
          expect(() => jsonToLex({ nested: json }, { strict: true })).toThrow()
          expect(() => jsonToLex([json], { strict: true })).toThrow()
        })
      })
    }
  })
})

describe('lexToJson', () => {
  describe('valid vectors', () => {
    for (const { name, json, lex } of validVectors) {
      describe(name, () => {
        it('converts lex to json', () => {
          expect(lexToJson(lex)).toEqual(json)
          expect(lexToJson(lex)).toEqual(json)
        })
      })
    }
  })
})

describe('json > lex > json', () => {
  describe('valid vectors', () => {
    for (const { name, json } of validVectors) {
      describe(name, () => {
        it('converts json to lex', () => {
          expect(lexToJson(jsonToLex(json))).toEqual(json)
        })
      })
    }
  })
})

describe('lex > json > lex', () => {
  describe('valid vectors', () => {
    for (const { name, lex } of validVectors) {
      describe(name, () => {
        it('converts lex to json', () => {
          expect(lexEquals(jsonToLex(lexToJson(lex)), lex)).toBe(true)
          expect(lexEquals(lex, jsonToLex(lexToJson(lex)))).toBe(true)
        })
      })
    }
  })
})
