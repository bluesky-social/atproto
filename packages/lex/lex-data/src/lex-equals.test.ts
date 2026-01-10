import { describe, expect, it } from 'vitest'
import { parseCid } from './cid.js'
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
    expectLexEqual([1, 2, 3], { 0: 1, 1: 2, 2: 3 }, false)
  })

  it('compares Uint8Arrays', () => {
    expectLexEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]), true)
    expectLexEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]), false)
    expectLexEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]), false)
    expectLexEqual(new Uint8Array([1, 2, 3]), 'not a Uint8Array', false)
  })

  it('compares CIDs', () => {
    const cid1 = parseCid(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    const cid2 = parseCid(cid1.toString())
    const cid3 = parseCid(cid1.toString())

    expectLexEqual(cid1, cid2, true)
    expectLexEqual(cid1, cid3, true)
    expectLexEqual(cid2, cid3, true)

    expectLexEqual(cid1, cid1.toString(), false)
    expectLexEqual(cid1, { not: 'a cid' }, false)
    expectLexEqual(cid1, [], false)
    expectLexEqual(cid1, cid1.bytes, false)
  })

  it('compares objects', () => {
    expectLexEqual({ a: 1, b: 2 }, { a: 1, b: 2 }, true)
    expectLexEqual(
      { a: 1, b: 2, c: undefined },
      { a: 1, b: 2, c: undefined },
      true,
    )
    expectLexEqual(
      { a: 1, b: 2, c: { e: 1, d: undefined } },
      { a: 1, b: 2, c: { d: undefined, e: 1 } },
      true,
    )
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

  it('accounts for undefined (but present) properties in objects', () => {
    expectLexEqual({ a: 1, b: undefined }, { a: 1 }, false)
    expectLexEqual(
      { a: 1, b: { c: undefined, d: 2 } },
      { a: 1, b: { d: 2 } },
      false,
    )

    expectLexEqual(
      { a: 1, b: { c: undefined, d: 2 } },
      { a: 1, b: { c: 3, d: 2 } },
      false,
    )
  })

  it('compares nested structures', () => {
    const lex1 = {
      foo: [1, 2, { bar: new Uint8Array([3, 4, 5]) }],
      baz: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const lex2 = {
      foo: [1, 2, { bar: new Uint8Array([3, 4, 5]) }],
      baz: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }
    const lex3 = {
      foo: [1, 2, { bar: new Uint8Array([3, 4, 5 + 1]) }],
      baz: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }

    expectLexEqual(lex1, lex2, true)
    expectLexEqual(lex1, lex3, false)
    expectLexEqual(lex2, lex3, false)
  })

  it('allows comparing invalid numbers (floats, NaN, Infinity)', () => {
    expectLexEqual(3.14, 2.71, false)
    expectLexEqual(NaN, 0, false)
    expectLexEqual(Infinity, -Infinity, false)
  })

  describe('reference equality', () => {
    for (const value of [3.14, NaN, Infinity, -Infinity]) {
      it(`returns true for identical references of ${String(value)}`, () => {
        expectLexEqual(value, value, true)
        expectLexEqual([value], [value], true)
        expectLexEqual({ foo: value }, { foo: value }, true)
        expectLexEqual([{ foo: value }], [{ foo: value }], true)
      })
    }
  })

  it('returns true for identical references', () => {
    const arr = [1, 2, 3]
    expectLexEqual(arr, arr, true)

    const obj = { a: 1, b: 2 }
    expectLexEqual(obj, obj, true)

    const u8 = new Uint8Array([1, 2, 3])
    expectLexEqual(u8, u8, true)

    const cid = parseCid(
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
