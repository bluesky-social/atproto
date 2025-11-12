import { CID } from './cid.js'
import { lexEquals } from './lex-equals.js'
import { LexValue } from './lex.js'

function expectLexEqual(a: LexValue, b: LexValue, expected: boolean) {
  expect(lexEquals(a, b)).toBe(expected)
  expect(lexEquals(b, a)).toBe(expected)
}

describe('lexEquals', () => {
  it('compares primitive values', () => {
    expectLexEqual(null, null, true)
    expectLexEqual(true, true, true)
    expectLexEqual(false, false, true)
    expectLexEqual(42, 42, true)
    expectLexEqual('hello', 'hello', true)

    expectLexEqual(null, false, false)
    expectLexEqual(false, null, false)
    expectLexEqual(true, false, false)
    expectLexEqual(false, true, false)
    expectLexEqual(42, 43, false)
    expectLexEqual('hello', 'world', false)
  })

  it('compares NaN and Infinity correctly', () => {
    expectLexEqual(NaN, NaN, true)
    expectLexEqual(Infinity, Infinity, true)
    expectLexEqual(-Infinity, -Infinity, true)

    expectLexEqual(NaN, 0, false)
    expectLexEqual(NaN, null, false)
    expectLexEqual(Infinity, -Infinity, false)
  })

  it('compares arrays', () => {
    expectLexEqual([1, 2, 3], [1, 2, 3], true)
    expectLexEqual([1, 2, 3], [1, 2, 4], false)
    expectLexEqual([1, 2, 3], [1, 2], false)
    expectLexEqual([1, 2, 3], 'not an array', false)
  })

  it('compares Uint8Arrays', () => {
    expectLexEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]), true)
    expectLexEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]), false)
    expectLexEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]), false)
    expectLexEqual(new Uint8Array([1, 2, 3]), 'not a Uint8Array', false)
  })

  it('compares CIDs', () => {
    const cid1 = CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    const cid2 = CID.parse(cid1.toString())
    const cid3 = CID.parse(cid1.toString())

    expectLexEqual(cid1, cid2, true)
    expectLexEqual(cid1, cid3, true)
    expectLexEqual(cid2, cid3, true)

    expectLexEqual(cid1, cid1.toString(), false)
  })

  it('compares objects', () => {
    expectLexEqual({ a: 1, b: 2 }, { a: 1, b: 2 }, true)
    expectLexEqual(
      { a: 1, b: { unicode: 'a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧' } },
      { a: 1, b: { unicode: 'a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧' } },
      true,
    )

    expectLexEqual({ a: 1, b: 2 }, { a: 1, b: 3 }, false)
    expectLexEqual({ a: 1, b: 2 }, { a: 1 }, false)
    expectLexEqual({ a: 1, b: 2 }, 'not an object', false)
    expectLexEqual({ a: 1, b: 2 }, null, false)
  })

  it('compares nested structures', () => {
    const lex1 = {
      foo: [1, 2, { bar: new Uint8Array([3, 4, 5]) }],
      baz: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const lex2 = {
      foo: [1, 2, { bar: new Uint8Array([3, 4, 5]) }],
      baz: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const lex3 = {
      foo: [1, 2, { bar: new Uint8Array([3, 4, 5 + 1]) }],
      baz: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }

    expectLexEqual(lex1, lex2, true)
    expectLexEqual(lex1, lex3, false)
    expectLexEqual(lex2, lex3, false)
  })

  it('allows comparing invalid numbers (floats, NaN, Infinity)', () => {
    expectLexEqual(3.14, 3.14, true)
    expectLexEqual(NaN, NaN, true)
    expectLexEqual(Infinity, Infinity, true)
    expectLexEqual([Infinity], [Infinity], true)
    expectLexEqual([{ foo: Infinity }], [{ foo: Infinity }], true)
    expectLexEqual({ v: -Infinity }, { v: -Infinity }, true)

    expectLexEqual(3.14, 2.71, false)
    expectLexEqual(NaN, 0, false)
    expectLexEqual(Infinity, -Infinity, false)
  })

  it('returns true for identical references', () => {
    const arr = [1, 2, 3]
    expectLexEqual(arr, arr, true)

    const obj = { a: 1, b: 2 }
    expectLexEqual(obj, obj, true)

    const u8 = new Uint8Array([1, 2, 3])
    expectLexEqual(u8, u8, true)

    const cid = CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    expectLexEqual(cid, cid, true)
  })

  it('throws when comparing plain object with non-allowed class instance', () => {
    // @ts-expect-error
    expect(() => lexEquals({}, new Map())).toThrow()
    // @ts-expect-error
    expect(() => lexEquals(new Map(), {})).toThrow()
    // @ts-expect-error
    expect(() => lexEquals({ foo: {} }, { foo: new Map() })).toThrow()
    // @ts-expect-error
    expect(() => lexEquals({ foo: new Map() }, { foo: {} })).toThrow()

    expect(() => lexEquals({ foo: {} }, { foo: new (class {})() })).toThrow()
    expect(() => lexEquals({ foo: new (class {})() }, { foo: {} })).toThrow()

    expect(() =>
      lexEquals({ foo: {} }, { foo: new (class Object {})() }),
    ).toThrow()
  })
})
