import { describe, expect, it } from 'vitest'
import { parseCid } from './cid.js'
import { isObject, isPlainObject } from './object.js'

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
  })

  it('returns true for CIDs', () => {
    const cid = parseCid(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    expect(isObject(cid)).toBe(true)
  })

  it('returns true for class instances', () => {
    class MyClass {}
    expect(isObject(new MyClass())).toBe(true)
  })

  it('returns true for arrays', () => {
    expect(isObject([])).toBe(true)
    expect(isObject([1, 2, 3])).toBe(true)
  })

  it('returns false for null', () => {
    expect(isObject(null)).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isObject(42)).toBe(false)
    expect(isObject('string')).toBe(false)
    expect(isObject(undefined)).toBe(false)
    expect(isObject(true)).toBe(false)
  })
})

describe('isPlainObject', () => {
  it('returns true for plain objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
  })

  it('returns true for objects with null prototype', () => {
    const obj = Object.create(null)
    obj.a = 1
    expect(isPlainObject(obj)).toBe(true)
    expect(isPlainObject({ __proto__: null, foo: 'bar' })).toBe(true)
  })

  it('returns false for class instances', () => {
    class MyClass {}
    expect(isPlainObject(new MyClass())).toBe(false)
  })

  it('returns false for CIDs', () => {
    const cid = parseCid(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )
    expect(isPlainObject(cid)).toBe(false)
  })

  it('returns false for arrays', () => {
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject([1, 2, 3])).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPlainObject(null)).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isPlainObject(42)).toBe(false)
    expect(isPlainObject('string')).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject(true)).toBe(false)
  })
})
