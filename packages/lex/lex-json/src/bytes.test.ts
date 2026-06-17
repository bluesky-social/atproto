import { describe, expect, it } from 'vitest'
import { encodeLexBytes, parseLexBytes } from './bytes.js'

describe(parseLexBytes, () => {
  it('parses valid $bytes object', () => {
    const bytes = Buffer.from('Hello, world!')
    const input = { $bytes: bytes.toString('base64') }
    const result = parseLexBytes(input)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(result!)).toBe('Hello, world!')
  })

  it('parses valid $bytes object (without padding)', () => {
    const bytes = Buffer.from('Hello, world!')
    const input = { $bytes: bytes.toString('base64').replace(/=*$/, '') }
    const result = parseLexBytes(input)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(result!)).toBe('Hello, world!')
  })

  it('returns undefined for non-$bytes object', () => {
    const input = { foo: 'bar' }
    const result = parseLexBytes(input)
    expect(result).toBeUndefined()
  })

  it('returns undefined for $bytes with non-string value', () => {
    const input = { $bytes: 12345 }
    const result = parseLexBytes(input)
    expect(result).toBeUndefined()
  })

  it('returns undefined for $bytes with extra properties', () => {
    const bytes = Buffer.from('Hello, world!')
    const input = { $bytes: bytes.toString('base64'), extra: true }
    const result = parseLexBytes(input)
    expect(result).toBeUndefined()
  })

  it('returns undefined for invalid base64 string', () => {
    const input = { $bytes: '!!!invalid-base64!!!' }
    const result = parseLexBytes(input)
    expect(result).toBeUndefined()
  })
})

describe(encodeLexBytes, () => {
  it('encodes Uint8Array to $bytes object', () => {
    const bytes = Buffer.from('Hello, world!')
    const result = encodeLexBytes(bytes)
    expect(result).toEqual({
      $bytes: bytes.toString('base64').replace(/=*$/, ''),
    })
  })
})
