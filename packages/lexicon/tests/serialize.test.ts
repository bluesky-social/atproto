import { lexToIpld } from '../src/serialize'

describe('lexToIpld', () => {
  it('does not stack overflow on deeply nested arrays', () => {
    // Reproduces a real-world crash: a malicious profile record contained a
    // field with thousands of nested CBOR arrays ([[[[...]]]]), causing
    // lexToIpld to overflow the call stack during response serialization.
    let val: unknown = 'leaf'
    for (let i = 0; i < 10_000; i++) {
      val = [val]
    }

    expect(() => lexToIpld(val)).not.toThrow()
  })

  it('does not stack overflow on deeply nested objects', () => {
    let val: unknown = 'leaf'
    for (let i = 0; i < 10_000; i++) {
      val = { nested: val }
    }

    expect(() => lexToIpld(val)).not.toThrow()
  })

  it('still converts shallow values correctly', () => {
    expect(lexToIpld('hello')).toBe('hello')
    expect(lexToIpld(42)).toBe(42)
    expect(lexToIpld(null)).toBe(null)
    expect(lexToIpld([1, 2, 3])).toEqual([1, 2, 3])
    expect(lexToIpld({ a: 1, b: 'two' })).toEqual({ a: 1, b: 'two' })
  })
})
