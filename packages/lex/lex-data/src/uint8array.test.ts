import 'core-js/modules/es.uint8-array.from-base64.js'
import 'core-js/modules/es.uint8-array.to-base64.js'

import { describe, expect, it } from 'vitest'
import {
  asUint8Array,
  fromBase64,
  toBase64,
  ui8Concat,
  ui8Equals,
} from './uint8array.js'

describe('toBase64', () => {
  it('encodes empty Uint8Array', () => {
    const encoded = toBase64(new Uint8Array(0))
    expect(typeof encoded).toBe('string')
    expect(encoded).toBe('')
  })

  it('encodes single byte', () => {
    const encoded = toBase64(new Uint8Array([0x4d]))
    expect(encoded).toBe('TQ')
  })

  it('encodes multiple bytes', () => {
    const encoded = toBase64(new Uint8Array([0x4d, 0x61, 0x6e]))
    expect(encoded).toBe('TWFu')
  })

  it('encodes with default alphabet (base64)', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
    const encoded = toBase64(bytes)
    expect(encoded).toContain('+')
    expect(encoded).toContain('/')
  })

  it('encodes with base64url alphabet', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
    const encoded = toBase64(bytes, 'base64url')
    expect(encoded).toContain('-')
    expect(encoded).toContain('_')
  })

  it('handles large data', () => {
    const bytes = new Uint8Array(10000).fill(0xaa)
    const encoded = toBase64(bytes)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)
  })
})

describe('fromBase64', () => {
  it('decodes empty string', () => {
    const decoded = fromBase64('')
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(decoded.length).toBe(0)
  })

  it('decodes single character', () => {
    const decoded = fromBase64('TQ')
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(decoded, new Uint8Array([0x4d]))).toBe(true)
  })

  it('decodes multiple characters', () => {
    const decoded = fromBase64('TWFu')
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(decoded, new Uint8Array([0x4d, 0x61, 0x6e]))).toBe(true)
  })

  it('decodes base64url alphabet', () => {
    const decoded = fromBase64('-_-_', 'base64url')
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(decoded, new Uint8Array([0xfb, 0xff, 0xbf]))).toBe(true)
  })

  it('decodes padded base64', () => {
    const decoded = fromBase64('TQ==')
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(decoded, new Uint8Array([0x4d]))).toBe(true)
  })

  it('decodes unpadded base64', () => {
    const decoded = fromBase64('TQ')
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(decoded, new Uint8Array([0x4d]))).toBe(true)
  })

  it('throws on invalid base64 string', () => {
    expect(() => fromBase64('@@@@')).toThrow()
  })

  it('handles large data', () => {
    const bytes = new Uint8Array(10000).fill(0xbb)
    const encoded = toBase64(bytes)
    const decoded = fromBase64(encoded)
    expect(ui8Equals(decoded, bytes)).toBe(true)
  })
})

describe('roundtrip toBase64 <-> fromBase64', () => {
  it('roundtrips empty array', () => {
    const original = new Uint8Array(0)
    const encoded = toBase64(original)
    const decoded = fromBase64(encoded)
    expect(ui8Equals(decoded, original)).toBe(true)
  })

  it('roundtrips all byte values', () => {
    const allBytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) {
      allBytes[i] = i
    }
    const encoded = toBase64(allBytes)
    const decoded = fromBase64(encoded)
    expect(ui8Equals(decoded, allBytes)).toBe(true)
  })

  it('roundtrips with base64url alphabet', () => {
    const original = new Uint8Array([0xfb, 0xff, 0xbf, 0x00, 0xff])
    const encoded = toBase64(original, 'base64url')
    const decoded = fromBase64(encoded, 'base64url')
    expect(ui8Equals(decoded, original)).toBe(true)
  })

  it('roundtrips random-like data', () => {
    const data = new Uint8Array([
      0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff, 0x10, 0x20, 0x30, 0x40,
    ])
    const encoded = toBase64(data)
    const decoded = fromBase64(encoded)
    expect(ui8Equals(decoded, data)).toBe(true)
  })
})

describe('asUint8Array', () => {
  describe('Uint8Array input', () => {
    it('returns same Uint8Array instance', () => {
      const input = new Uint8Array([1, 2, 3])
      const result = asUint8Array(input)
      expect(result).toBe(input)
    })

    it('returns same empty Uint8Array instance', () => {
      const input = new Uint8Array(0)
      const result = asUint8Array(input)
      expect(result).toBe(input)
    })
  })

  describe('ArrayBuffer input', () => {
    it('converts ArrayBuffer to Uint8Array', () => {
      const buffer = new ArrayBuffer(4)
      const view = new Uint8Array(buffer)
      view.set([1, 2, 3, 4])
      const result = asUint8Array(buffer)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(ui8Equals(result!, new Uint8Array([1, 2, 3, 4]))).toBe(true)
    })

    it('converts empty ArrayBuffer to empty Uint8Array', () => {
      const buffer = new ArrayBuffer(0)
      const result = asUint8Array(buffer)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result!.length).toBe(0)
    })
  })

  describe('TypedArray (ArrayBufferView) input', () => {
    it('converts Int8Array to Uint8Array', () => {
      const input = new Int8Array([1, 2, 3, 4])
      const result = asUint8Array(input)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result!.length).toBe(4)
    })

    it('converts Int16Array to Uint8Array', () => {
      const input = new Int16Array([1, 2])
      const result = asUint8Array(input)
      expect(result).toBeInstanceOf(Uint8Array)
      // Int16Array has 2 bytes per element, so 2 elements = 4 bytes
      expect(result!.length).toBe(4)
    })

    it('converts Int32Array to Uint8Array', () => {
      const input = new Int32Array([1])
      const result = asUint8Array(input)
      expect(result).toBeInstanceOf(Uint8Array)
      // Int32Array has 4 bytes per element, so 1 element = 4 bytes
      expect(result!.length).toBe(4)
    })

    it('converts Float32Array to Uint8Array', () => {
      const input = new Float32Array([1.5])
      const result = asUint8Array(input)
      expect(result).toBeInstanceOf(Uint8Array)
      // Float32Array has 4 bytes per element
      expect(result!.length).toBe(4)
    })

    it('converts Float64Array to Uint8Array', () => {
      const input = new Float64Array([1.5])
      const result = asUint8Array(input)
      expect(result).toBeInstanceOf(Uint8Array)
      // Float64Array has 8 bytes per element
      expect(result!.length).toBe(8)
    })

    it('converts DataView to Uint8Array', () => {
      const buffer = new ArrayBuffer(4)
      const view = new DataView(buffer)
      view.setUint8(0, 1)
      view.setUint8(1, 2)
      view.setUint8(2, 3)
      view.setUint8(3, 4)
      const result = asUint8Array(view)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(ui8Equals(result!, new Uint8Array([1, 2, 3, 4]))).toBe(true)
    })

    it('handles TypedArray with byteOffset', () => {
      const buffer = new ArrayBuffer(8)
      const fullView = new Uint8Array(buffer)
      fullView.set([0, 0, 1, 2, 3, 4, 0, 0])
      // Create a view with offset
      const offsetView = new Uint8Array(buffer, 2, 4)
      const result = asUint8Array(offsetView)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result).toBe(offsetView) // Uint8Array returns same instance
    })

    it('handles Int16Array with byteOffset correctly', () => {
      const buffer = new ArrayBuffer(8)
      const fullView = new Uint8Array(buffer)
      fullView.set([0, 0, 1, 0, 2, 0, 0, 0])
      // Create Int16Array starting at byte 2, with 2 elements
      const int16View = new Int16Array(buffer, 2, 2)
      const result = asUint8Array(int16View)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result!.length).toBe(4) // 2 Int16 elements = 4 bytes
    })
  })

  describe('invalid inputs', () => {
    it('returns undefined for null', () => {
      const result = asUint8Array(null)
      expect(result).toBeUndefined()
    })

    it('returns undefined for undefined', () => {
      const result = asUint8Array(undefined)
      expect(result).toBeUndefined()
    })

    it('returns undefined for string', () => {
      const result = asUint8Array('hello')
      expect(result).toBeUndefined()
    })

    it('returns undefined for number', () => {
      const result = asUint8Array(42)
      expect(result).toBeUndefined()
    })

    it('returns undefined for boolean', () => {
      const result = asUint8Array(true)
      expect(result).toBeUndefined()
    })

    it('returns undefined for plain object', () => {
      const result = asUint8Array({ foo: 'bar' })
      expect(result).toBeUndefined()
    })

    it('returns undefined for array', () => {
      const result = asUint8Array([1, 2, 3])
      expect(result).toBeUndefined()
    })

    it('returns undefined for function', () => {
      const result = asUint8Array(() => {})
      expect(result).toBeUndefined()
    })

    it('returns undefined for symbol', () => {
      const result = asUint8Array(Symbol('test'))
      expect(result).toBeUndefined()
    })

    it('returns undefined for BigInt', () => {
      const result = asUint8Array(BigInt(42))
      expect(result).toBeUndefined()
    })
  })
})

describe('ui8Equals', () => {
  describe('equal arrays', () => {
    it('returns true for identical arrays', () => {
      const a = new Uint8Array([1, 2, 3])
      const b = new Uint8Array([1, 2, 3])
      expect(ui8Equals(a, b)).toBe(true)
    })

    it('returns true for same instance', () => {
      const a = new Uint8Array([1, 2, 3])
      expect(ui8Equals(a, a)).toBe(true)
    })

    it('returns true for empty arrays', () => {
      const a = new Uint8Array(0)
      const b = new Uint8Array(0)
      expect(ui8Equals(a, b)).toBe(true)
    })

    it('returns true for single element arrays', () => {
      const a = new Uint8Array([255])
      const b = new Uint8Array([255])
      expect(ui8Equals(a, b)).toBe(true)
    })

    it('returns true for arrays with all zeros', () => {
      const a = new Uint8Array([0, 0, 0])
      const b = new Uint8Array([0, 0, 0])
      expect(ui8Equals(a, b)).toBe(true)
    })

    it('returns true for arrays with all 255s', () => {
      const a = new Uint8Array([255, 255, 255])
      const b = new Uint8Array([255, 255, 255])
      expect(ui8Equals(a, b)).toBe(true)
    })
  })

  describe('unequal arrays - different lengths', () => {
    it('returns false when first is longer', () => {
      const a = new Uint8Array([1, 2, 3, 4])
      const b = new Uint8Array([1, 2, 3])
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('returns false when second is longer', () => {
      const a = new Uint8Array([1, 2, 3])
      const b = new Uint8Array([1, 2, 3, 4])
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('returns false when one is empty', () => {
      const a = new Uint8Array([1])
      const b = new Uint8Array(0)
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('returns false when comparing empty to non-empty', () => {
      const a = new Uint8Array(0)
      const b = new Uint8Array([1])
      expect(ui8Equals(a, b)).toBe(false)
    })
  })

  describe('unequal arrays - different content', () => {
    it('returns false when first byte differs', () => {
      const a = new Uint8Array([1, 2, 3])
      const b = new Uint8Array([0, 2, 3])
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('returns false when middle byte differs', () => {
      const a = new Uint8Array([1, 2, 3])
      const b = new Uint8Array([1, 0, 3])
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('returns false when last byte differs', () => {
      const a = new Uint8Array([1, 2, 3])
      const b = new Uint8Array([1, 2, 0])
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('returns false for completely different arrays', () => {
      const a = new Uint8Array([0, 0, 0])
      const b = new Uint8Array([255, 255, 255])
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('returns false when single values differ', () => {
      const a = new Uint8Array([0])
      const b = new Uint8Array([1])
      expect(ui8Equals(a, b)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles boundary byte values', () => {
      const a = new Uint8Array([0x00, 0x7f, 0x80, 0xff])
      const b = new Uint8Array([0x00, 0x7f, 0x80, 0xff])
      expect(ui8Equals(a, b)).toBe(true)
    })

    it('detects difference at boundary values', () => {
      const a = new Uint8Array([0x7f])
      const b = new Uint8Array([0x80])
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('handles large arrays efficiently', () => {
      const size = 100000
      const a = new Uint8Array(size).fill(0xaa)
      const b = new Uint8Array(size).fill(0xaa)
      expect(ui8Equals(a, b)).toBe(true)
    })

    it('detects single byte difference in large arrays', () => {
      const size = 100000
      const a = new Uint8Array(size).fill(0xaa)
      const b = new Uint8Array(size).fill(0xaa)
      b[size - 1] = 0xbb // Difference at the end
      expect(ui8Equals(a, b)).toBe(false)
    })

    it('compares subarrays correctly', () => {
      const full = new Uint8Array([0, 1, 2, 3, 4, 5])
      const sub1 = full.subarray(1, 4) // [1, 2, 3]
      const sub2 = new Uint8Array([1, 2, 3])
      expect(ui8Equals(sub1, sub2)).toBe(true)
    })

    it('detects difference in subarrays', () => {
      const full = new Uint8Array([0, 1, 2, 3, 4, 5])
      const sub1 = full.subarray(1, 4) // [1, 2, 3]
      const sub2 = new Uint8Array([1, 2, 4]) // Different last byte
      expect(ui8Equals(sub1, sub2)).toBe(false)
    })
  })
})

describe('ui8Concat', () => {
  it('concatenates empty array', () => {
    const result = ui8Concat([])
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(0)
  })

  it('concatenates single array', () => {
    const input = new Uint8Array([1, 2, 3])
    const result = ui8Concat([input])
    expect(result).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(result, input)).toBe(true)
  })

  it('concatenates two arrays', () => {
    const a = new Uint8Array([1, 2])
    const b = new Uint8Array([3, 4])
    const result = ui8Concat([a, b])
    expect(result).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(result, new Uint8Array([1, 2, 3, 4]))).toBe(true)
  })

  it('concatenates multiple arrays', () => {
    const arrays = [
      new Uint8Array([1]),
      new Uint8Array([2, 3]),
      new Uint8Array([4, 5, 6]),
    ]
    const result = ui8Concat(arrays)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(result, new Uint8Array([1, 2, 3, 4, 5, 6]))).toBe(true)
  })

  it('handles empty arrays in input', () => {
    const a = new Uint8Array(0)
    const b = new Uint8Array([1, 2])
    const c = new Uint8Array(0)
    const result = ui8Concat([a, b, c])
    expect(result).toBeInstanceOf(Uint8Array)
    expect(ui8Equals(result, new Uint8Array([1, 2]))).toBe(true)
  })

  it('handles all empty arrays', () => {
    const result = ui8Concat([new Uint8Array(0), new Uint8Array(0)])
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(0)
  })
})
