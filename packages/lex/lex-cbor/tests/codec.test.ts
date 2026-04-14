import { assert, describe, expect, it } from 'vitest'
import { LexValue, isLexMap, parseCid } from '@atproto/lex-data'
import { decode, decodeAll, encode } from '../src/index.js'

describe('encode', () => {
  it('encodes data to CBOR format', () => {
    expect(encode({ hello: 'world' })).toEqual(
      Uint8Array.from([
        0xa1, 0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x65, 0x77, 0x6f, 0x72, 0x6c,
        0x64,
      ]),
    )
  })

  it('throws when encoding floats', () => {
    expect(() => encode({ value: 3.14 })).toThrow()
  })

  it('Supports encoding "undefined" values', () => {
    expect(encode({ value: undefined })).toStrictEqual(encode({}))
    expect(encode({ a: 1, value: undefined })).toStrictEqual(encode({ a: 1 }))
    expect(encode({ foo: { bar: undefined } })).toStrictEqual(
      encode({ foo: {} }),
    )
  })

  it('throws when encoding Maps with non-string keys', () => {
    expect(() =>
      // @ts-expect-error
      encode({
        foo: new Map<any, any>([
          [42, 'value'],
          ['key', 'value2'],
        ]),
      }),
    ).toThrow()
  })
})

describe('decode', () => {
  it('decodes CBOR data to original format', () => {
    const bytes = Uint8Array.from([
      0xa1, 0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x65, 0x77, 0x6f, 0x72, 0x6c,
      0x64,
    ])
    expect(decode(bytes)).toEqual({ hello: 'world' })
  })
})

describe('identity', () => {
  for (const vector of [
    null,
    parseCid('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
    [
      parseCid('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
      parseCid('bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q'),
      parseCid('bafyreiaizynclnqiolq7byfpjjtgqzn4sfrsgn7z2hhf6bo4utdwkin7ke'),
      parseCid('bafyreifd4w4tcr5tluxz7osjtnofffvtsmgdqcfrfi6evjde4pl27lrjpy'),
    ],
    new Uint8Array(Buffer.from('hello world')),
    true,
    false,
    0,
    42,
    -1,
    '',
    'hello world',
    [],
    [1, 2, 3],
    {},
    { a: 1, b: 'two', c: true },
    {
      nested: {
        array: { value: [1, 2, 3] },
        object: { key: 'value' },
        cid: parseCid(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
        bytes: new Uint8Array(Buffer.from('byte array')),
      },
    },
  ] as LexValue[]) {
    it(JSON.stringify(vector), () => {
      const cbor = encode(vector)
      const decoded = decode(cbor)
      expect(decoded).toEqual(vector)
      expect(encode(decoded)).toEqual(cbor)
    })
  }
})

describe('ipld decode multi', () => {
  it('decodes concatenated dag-cbor messages', async () => {
    const one = {
      a: 123,
      b: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const two = {
      c: new Uint8Array([1, 2, 3]),
      d: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const encoded = Buffer.concat([encode(one), encode(two)])
    const decoded = Array.from(decodeAll(encoded))
    expect(decoded.length).toBe(2)
    expect(decoded[0]).toEqual(one)
    expect(decoded[1]).toEqual(two)
  })

  it('parses safe ints as number', async () => {
    const one = {
      test: Number.MAX_SAFE_INTEGER,
    }
    const encoded = encode(one)
    const { length, 0: first } = Array.from(decodeAll(encoded))
    expect(length).toBe(1)
    assert(isLexMap(first))
    expect(Number.isInteger(first.test)).toBe(true)
  })
})
