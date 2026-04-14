import { lexToIpld } from '../src/serialize'

describe('lexToIpld', () => {
  it('truncates deeply nested arrays at depth limit', () => {
    // Reproduces a real-world crash: a malicious profile record contained a
    // field with thousands of nested CBOR arrays ([[[[...]]]]), causing
    // lexToIpld to overflow the call stack during response serialization.
    let val: unknown = 'leaf'
    for (let i = 0; i < 200; i++) {
      val = [val]
    }

    // Should not throw (previously would stack overflow on production
    // containers with smaller stacks)
    const result = lexToIpld(val)

    // Walk the result to verify: valid structure down to the depth limit,
    // then null beyond it
    let current = result
    let depth = 0
    while (Array.isArray(current) && current.length === 1) {
      current = current[0]
      depth++
    }
    // Should have stopped recursing at the depth limit (128), replacing
    // deeper values with null
    expect(current).toBeNull()
    expect(depth).toBe(129)
  })

  it('truncates deeply nested objects at depth limit', () => {
    let val: unknown = 'leaf'
    for (let i = 0; i < 200; i++) {
      val = { nested: val }
    }

    const result = lexToIpld(val)

    let current = result as Record<string, unknown>
    let depth = 0
    while (
      current !== null &&
      typeof current === 'object' &&
      'nested' in current
    ) {
      current = current.nested as Record<string, unknown>
      depth++
    }
    expect(current).toBeNull()
    expect(depth).toBe(129)
  })

  it('preserves structure below the depth limit', () => {
    expect(lexToIpld('hello')).toBe('hello')
    expect(lexToIpld(42)).toBe(42)
    expect(lexToIpld(null)).toBe(null)
    expect(lexToIpld([1, 2, 3])).toEqual([1, 2, 3])
    expect(lexToIpld({ a: 1, b: 'two' })).toEqual({ a: 1, b: 'two' })
    expect(lexToIpld({ nested: { deep: [1] } })).toEqual({
      nested: { deep: [1] },
    })
  })
})
