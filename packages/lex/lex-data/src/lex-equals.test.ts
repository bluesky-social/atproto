import { CID } from './cid.js'
import { lexEquals } from './lex-equals.js'

describe('lexEquals', () => {
  it('compares primitive values', () => {
    expect(lexEquals(null, null)).toBe(true)
    expect(lexEquals(true, true)).toBe(true)
    expect(lexEquals(false, false)).toBe(true)
    expect(lexEquals(42, 42)).toBe(true)
    expect(lexEquals('hello', 'hello')).toBe(true)

    expect(lexEquals(null, false)).toBe(false)
    expect(lexEquals(true, false)).toBe(false)
    expect(lexEquals(42, 43)).toBe(false)
    expect(lexEquals('hello', 'world')).toBe(false)
  })

  it('compares arrays', () => {
    expect(lexEquals([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(lexEquals([1, 2, 3], [1, 2, 4])).toBe(false)
    expect(lexEquals([1, 2, 3], [1, 2])).toBe(false)
    expect(lexEquals([1, 2, 3], 'not an array')).toBe(false)
  })

  it('compares Uint8Arrays', () => {
    expect(
      lexEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])),
    ).toBe(true)
    expect(
      lexEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])),
    ).toBe(false)
    expect(lexEquals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(
      false,
    )
    expect(lexEquals(new Uint8Array([1, 2, 3]), 'not a Uint8Array')).toBe(false)
  })

  it('compares CIDs', () => {
    const cid1 = CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    const cid2 = CID.parse(cid1.toString())
    const cid3 = CID.parse(cid1.toString())

    expect(lexEquals(cid1, cid2)).toBe(true)
    expect(lexEquals(cid1, cid3)).toBe(true)
    expect(lexEquals(cid2, cid3)).toBe(true)

    expect(lexEquals(cid1, cid1.toString())).toBe(false)
  })

  it('compares objects', () => {
    expect(lexEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    expect(lexEquals({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false)
    expect(lexEquals({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    expect(lexEquals({ a: 1, b: 2 }, 'not an object')).toBe(false)
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
      foo: [1, 2, { bar: new Uint8Array([3, 4, 6]) }],
      baz: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }

    expect(lexEquals(lex1, lex2)).toBe(true)
    expect(lexEquals(lex1, lex3)).toBe(false)
    expect(lexEquals(lex2, lex3)).toBe(false)
  })

  it('allows comparing invalid numbers (floats, NaN, Infinity)', () => {
    expect(lexEquals(3.14, 3.14)).toBe(true)
    expect(lexEquals(NaN, NaN)).toBe(true)
    expect(lexEquals(Infinity, Infinity)).toBe(true)
    expect(lexEquals([Infinity], [Infinity])).toBe(true)
    expect(lexEquals([{ foo: Infinity }], [{ foo: Infinity }])).toBe(true)
    expect(lexEquals({ v: -Infinity }, { v: -Infinity })).toBe(true)

    expect(lexEquals(3.14, 2.71)).toBe(false)
    expect(lexEquals(NaN, 0)).toBe(false)
    expect(lexEquals(Infinity, -Infinity)).toBe(false)
  })

  it('returns true for identical references', () => {
    const arr = [1, 2, 3]
    expect(lexEquals(arr, arr)).toBe(true)

    const obj = { a: 1, b: 2 }
    expect(lexEquals(obj, obj)).toBe(true)

    const u8 = new Uint8Array([1, 2, 3])
    expect(lexEquals(u8, u8)).toBe(true)

    const cid = CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    expect(lexEquals(cid, cid)).toBe(true)
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
