import { decodeFirst } from 'cborg'
import { encodedLength } from 'cborg/length'
import { assert, describe, test } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import * as dagcbor from '../src/index.js'

const same = assert.deepStrictEqual
const { encode, decode } = dagcbor

const CID = { parse: parseCid }
const bytes = {
  isBinary: (data: unknown): data is Uint8Array | ArrayBuffer => {
    return data instanceof Uint8Array
  },
  toHex: (data: Uint8Array | ArrayBuffer): string => {
    return Buffer.from(data).toString('hex')
  },
  fromHex: (hex: string): Uint8Array => {
    return Buffer.from(hex, 'hex')
  },
}

const garbage = (length: number): Uint8Array => {
  const arr = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    arr[i] = Math.floor(Math.random() * 256)
  }
  return arr
}

// The code bellow was copied from
// https://github.com/ipld/js-dag-cbor/blob/fdcaa70e2b5830ee3ca410d63e7c9c57fafd3b61/test/test-basics.spec.js
// which is licensed under the same license at this package (MIT and Apache-2.0 dual license)

describe('dag-cbor', () => {
  const obj = {
    someKey: 'someValue',
    link: CID.parse('QmRgutAxd8t7oGkSm4wmeuByG6M51wcTso6cubDdQtuEfL'),
    links: [
      CID.parse('QmRgutAxd8t7oGkSm4wmeuByG6M51wcTso6cubDdQtuEfL'),
      CID.parse('QmRgutAxd8t7oGkSm4wmeuByG6M51wcTso6cubDdQtuEfL'),
    ],
    nested: {
      hello: 'world',
      link: CID.parse('QmRgutAxd8t7oGkSm4wmeuByG6M51wcTso6cubDdQtuEfL'),
    },
    bytes: new TextEncoder().encode('asdf'),
  }
  const serializedObj = encode(obj)

  test('.serialize and .deserialize', () => {
    same(bytes.isBinary(serializedObj), true)

    // Check for the tag 42
    // d8 = tag, 2a = 42
    same(bytes.toHex(serializedObj).match(/d82a/g)?.length, 4)

    const deserializedObj = decode(serializedObj)
    same(deserializedObj, obj)
  })

  test('.serialize and .deserialize with ArrayBuffer', () => {
    same(bytes.isBinary(serializedObj), true)

    // Check for the tag 42
    // d8 = tag, 2a = 42
    same(bytes.toHex(serializedObj).match(/d82a/g)?.length, 4)

    const deserializedObj = decode(
      new Uint8Array(
        serializedObj.buffer.slice(
          serializedObj.byteOffset,
          serializedObj.byteOffset + serializedObj.byteLength,
        ),
      ),
    )
    same(deserializedObj, obj)
  })

  test('.serialize and .deserialize large objects', () => {
    // larger than the default borc heap size, should auto-grow the heap
    const dataSize = 128 * 1024
    const largeObj = { someKey: [].slice.call(new Uint8Array(dataSize)) }

    const serialized = encode(largeObj)
    same(bytes.isBinary(serialized), true)

    const deserialized = decode(serialized)
    same(largeObj, deserialized)
  })

  test('.serialize and .deserialize object with slash as property', () => {
    const slashObject = { '/': true }
    const serialized = encode(slashObject)
    const deserialized = decode(serialized)
    same(deserialized, slashObject)
  })

  test('CIDs have clean for deep comparison', () => {
    const deserializedObj = decode(serializedObj)
    // backing buffer must be pristine as some comparison libraries go that deep

    // @ts-expect-error
    const actual = deserializedObj.link.bytes.join(',')
    const expected = obj.link.bytes.join(',')
    same(actual, expected)
  })

  test('error on circular references', () => {
    type Circular = { a?: Circular | Circular[] }
    const circularObj: Circular = {}
    circularObj.a = circularObj
    assert.throws(
      () => encode(circularObj),
      /object contains circular references/,
    )
    const circularArr = [circularObj]
    circularObj.a = circularArr
    assert.throws(
      () => encode(circularArr),
      /object contains circular references/,
    )
  })

  test('error on encoding undefined', () => {
    // @ts-expect-error
    assert.throws(() => encode(undefined), /\Wundefined\W.*not supported/)
  })

  test('Ignores undefined object properties', () => {
    const objWithUndefined = { a: 'a', b: undefined }
    const serialized = encode(objWithUndefined)
    const deserialized = decode(serialized)
    same(deserialized, { a: 'a' })
  })

  test('error on encoding IEEE 754 specials', () => {
    for (const special of [NaN, Infinity, -Infinity]) {
      assert.throws(
        () => encode(special),
        new RegExp(`\\W${String(special)}\\W.*not supported`),
      )
      const objWithSpecial = { a: 'a', b: special }
      assert.throws(
        () => encode(objWithSpecial),
        new RegExp(`\\W${String(special)}\\W.*not supported`),
      )
      const arrWithSpecial = [
        1,
        -1,
        Number.MAX_SAFE_INTEGER,
        special,
        Number.MIN_SAFE_INTEGER,
      ]
      assert.throws(
        () => encode(arrWithSpecial),
        new RegExp(`\\W${String(special)}\\W.*not supported`),
      )
    }
  })

  test('error on decoding IEEE 754 specials', () => {
    // encoded forms of each of the previous encode() tests
    const cases = [
      ['NaN', 'f97e00'],
      ['NaN', 'f97ff8'],
      ['NaN', 'fa7ff80000'],
      ['NaN', 'fb7ff8000000000000'],
      ['NaN', 'a2616161616162fb7ff8000000000000'],
      [
        'NaN',
        '8701fb3ff199999999999a20fbbff199999999999a1b001ffffffffffffffb7ff80000000000003b001ffffffffffffe',
      ],
      ['Infinity', 'f97c00'],
      ['Infinity', 'fb7ff0000000000000'],
      ['Infinity', 'a2616161616162fb7ff0000000000000'],
      [
        'Infinity',
        '8701fb3ff199999999999a20fbbff199999999999a1b001ffffffffffffffb7ff00000000000003b001ffffffffffffe',
      ],
      ['-Infinity', 'f9fc00'],
      ['-Infinity', 'fbfff0000000000000'],
      ['-Infinity', 'a2616161616162fbfff0000000000000'],
      [
        '-Infinity',
        '8701fb3ff199999999999a20fbbff199999999999a1b001ffffffffffffffbfff00000000000003b001ffffffffffffe',
      ],
    ]
    for (const [typ, hex] of cases) {
      const byts = bytes.fromHex(hex)
      assert.throws(
        () => decode(byts),
        new RegExp(`\\W${typ.replace(/^-/, '')}\\W.*not supported`),
      )
    }
  })

  test('fuzz serialize and deserialize with garbage', function () {
    for (let ii = 0; ii < 1000; ii++) {
      const original = garbage(100)
      const encoded = encode(original)
      const decoded = decode(encoded)
      same(decoded, original)
    }
  })

  test('CIDv1', () => {
    const link = CID.parse('zdj7Wd8AMwqnhJGQCbFxBVodGSBG84TM7Hs1rcJuQMwTyfEDS')
    const encoded = encode({ link })
    const decoded = decode(encoded)
    same(decoded, { link })
  })

  test('encode and decode consistency with Uint8Array and Buffer fields', () => {
    const buffer = Buffer.from('some data')
    const bytes = Uint8Array.from(buffer)

    const s1 = encode({ data: buffer })
    const s2 = encode({ data: bytes })

    same(s1, s2)

    const verify = (s: { data: Uint8Array }) => {
      same(typeof s, 'object')
      same(Object.keys(s), ['data'])
      assert(s.data instanceof Uint8Array)
      same(s.data.buffer, bytes.buffer)
    }
    verify(decode(s1))
    verify(decode(s2))
  })

  test('reject extraneous, but valid CBOR data after initial top-level object', () => {
    assert.throws(() => {
      // two top-level CBOR objects, the original and a single uint=0, valid if using
      // CBOR in streaming mode, not valid here
      const big = new Uint8Array(serializedObj.length + 1)
      big.set(serializedObj, 0)
      decode(big)
    }, /too many terminals/)
  })

  test('reject bad CID lead-in', () => {
    // this is the same data as the CIDv1 produces but has the lead-in to the
    // CID replaced with 0x01 .......................  ↓↓ here
    const encoded = bytes.fromHex(
      'a1646c696e6bd82a582501017012207252523e6591fb8fe553d67ff55a86f84044b46a3e4176e10c58fa529a4aabd5',
    )
    assert.throws(
      () => decode(encoded),
      /Invalid CID for CBOR tag 42; expected leading 0x00/,
    )
  })

  test('sloppy decode: coerce undefined', () => {
    // See https://github.com/ipld/js-dag-cbor/issues/44 for context on this
    let encoded = bytes.fromHex('f7')
    let decoded = decode(encoded)
    same(null, decoded)

    encoded = bytes.fromHex('a26362617af763666f6f63626172')
    decoded = decode(encoded)
    same({ foo: 'bar', baz: null }, decoded)
  })

  test('reject duplicate map keys', () => {
    const encoded = bytes.fromHex('a3636261720363666f6f0163666f6f02')
    assert.throws(
      () => decode(encoded),
      /CBOR decode error: found repeat map key "foo"/,
    )
  })

  test('determine encoded length of obj', () => {
    const { encodeOptions } = dagcbor

    const length = encodedLength(obj, encodeOptions)
    same(length, serializedObj.length)
  })

  test('.deserialize the first of concatenated serialized objects', () => {
    const { decodeOptions } = dagcbor

    const concatSerializedObjs = new Uint8Array(serializedObj.length * 2)
    concatSerializedObjs.set(serializedObj)
    concatSerializedObjs.set(serializedObj, serializedObj.length)

    const [deserializedObj, remainder] = decodeFirst(
      concatSerializedObjs,
      decodeOptions,
    )
    same(deserializedObj, obj)
    same(remainder, serializedObj)
  })
})
