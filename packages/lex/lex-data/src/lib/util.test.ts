import { describe, expect, it } from 'vitest'
import { isUint8, toHexString } from './util.js'

describe('toHexString', () => {
  it('converts 0 to 0x00', () => {
    expect(toHexString(0)).toBe('0x00')
  })

  it('converts single-digit hex values with padding', () => {
    expect(toHexString(1)).toBe('0x01')
    expect(toHexString(15)).toBe('0x0f')
  })

  it('converts two-digit hex values without extra padding', () => {
    expect(toHexString(16)).toBe('0x10')
    expect(toHexString(255)).toBe('0xff')
  })

  it('converts larger numbers', () => {
    expect(toHexString(256)).toBe('0x100')
    expect(toHexString(4096)).toBe('0x1000')
  })
})

describe('isUint8', () => {
  it('returns true for valid uint8 values', () => {
    expect(isUint8(0)).toBe(true)
    expect(isUint8(1)).toBe(true)
    expect(isUint8(127)).toBe(true)
    expect(isUint8(255)).toBe(true)
  })

  it('returns false for values outside uint8 range', () => {
    expect(isUint8(-1)).toBe(false)
    expect(isUint8(256)).toBe(false)
  })

  it('returns false for non-integer numbers', () => {
    expect(isUint8(1.5)).toBe(false)
    expect(isUint8(0.1)).toBe(false)
  })

  it('returns false for non-number types', () => {
    expect(isUint8('0')).toBe(false)
    expect(isUint8(null)).toBe(false)
    expect(isUint8(undefined)).toBe(false)
    expect(isUint8(true)).toBe(false)
  })
})
