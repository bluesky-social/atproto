import { describe, expect, it } from 'vitest'
import { bytes } from './bytes.js'

describe('BytesSchema', () => {
  describe('basic validation', () => {
    const schema = bytes({})

    it('validates Uint8Array', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2, 3]))
      expect(result.success).toBe(true)
    })

    it('validates empty Uint8Array', () => {
      const result = schema.safeParse(new Uint8Array([]))
      expect(result.success).toBe(true)
    })

    it('validates ArrayBuffer', () => {
      const buffer = new ArrayBuffer(4)
      const result = schema.safeParse(buffer)
      expect(result.success).toBe(true)
    })

    it('validates TypedArray views', () => {
      const int8 = new Int8Array([1, 2, 3])
      const result = schema.safeParse(int8)
      expect(result.success).toBe(true)
    })

    it('validates Uint16Array', () => {
      const uint16 = new Uint16Array([1, 2, 3])
      const result = schema.safeParse(uint16)
      expect(result.success).toBe(true)
    })

    it('validates DataView', () => {
      const buffer = new ArrayBuffer(4)
      const dataView = new DataView(buffer)
      const result = schema.safeParse(dataView)
      expect(result.success).toBe(true)
    })

    it('rejects strings', () => {
      const result = schema.safeParse('not bytes')
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects objects', () => {
      const result = schema.safeParse({ data: [1, 2, 3] })
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse([1, 2, 3])
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('minLength constraint', () => {
    const schema = bytes({ minLength: 3 })

    it('validates bytes at minimum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2]))
      expect(result.success).toBe(true)
    })

    it('validates bytes above minimum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2, 3, 4]))
      expect(result.success).toBe(true)
    })

    it('rejects bytes below minimum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1]))
      expect(result.success).toBe(false)
    })

    it('rejects empty bytes when minLength is set', () => {
      const result = schema.safeParse(new Uint8Array([]))
      expect(result.success).toBe(false)
    })
  })

  describe('maxLength constraint', () => {
    const schema = bytes({ maxLength: 5 })

    it('validates bytes at maximum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2, 3, 4]))
      expect(result.success).toBe(true)
    })

    it('validates bytes below maximum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2]))
      expect(result.success).toBe(true)
    })

    it('validates empty bytes when only maxLength is set', () => {
      const result = schema.safeParse(new Uint8Array([]))
      expect(result.success).toBe(true)
    })

    it('rejects bytes above maximum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2, 3, 4, 5]))
      expect(result.success).toBe(false)
    })
  })

  describe('minLength and maxLength constraints', () => {
    const schema = bytes({ minLength: 2, maxLength: 5 })

    it('validates bytes within range', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2]))
      expect(result.success).toBe(true)
    })

    it('validates bytes at minimum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1]))
      expect(result.success).toBe(true)
    })

    it('validates bytes at maximum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2, 3, 4]))
      expect(result.success).toBe(true)
    })

    it('rejects bytes below minimum length', () => {
      const result = schema.safeParse(new Uint8Array([0]))
      expect(result.success).toBe(false)
    })

    it('rejects bytes above maximum length', () => {
      const result = schema.safeParse(new Uint8Array([0, 1, 2, 3, 4, 5]))
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('validates with minLength of 0', () => {
      const schema = bytes({ minLength: 0 })
      const result = schema.safeParse(new Uint8Array([]))
      expect(result.success).toBe(true)
    })

    it('validates with maxLength of 0', () => {
      const schema = bytes({ maxLength: 0 })
      const result = schema.safeParse(new Uint8Array([]))
      expect(result.success).toBe(true)
    })

    it('rejects non-empty bytes with maxLength of 0', () => {
      const schema = bytes({ maxLength: 0 })
      const result = schema.safeParse(new Uint8Array([0]))
      expect(result.success).toBe(false)
    })

    it('validates bytes with all zeros', () => {
      const schema = bytes({})
      const result = schema.safeParse(new Uint8Array([0, 0, 0, 0]))
      expect(result.success).toBe(true)
    })

    it('validates bytes with all 255s', () => {
      const schema = bytes({})
      const result = schema.safeParse(new Uint8Array([255, 255, 255, 255]))
      expect(result.success).toBe(true)
    })

    it('validates large byte arrays', () => {
      const schema = bytes({})
      const largeArray = new Uint8Array(10000)
      const result = schema.safeParse(largeArray)
      expect(result.success).toBe(true)
    })
  })

  describe('TypedArray coercion', () => {
    const schema = bytes({})

    it('coerces Int8Array to Uint8Array', () => {
      const int8 = new Int8Array([1, 2, 3])
      const result = schema.safeParse(int8)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBeInstanceOf(Uint8Array)
      }
    })

    it('coerces Uint16Array to Uint8Array', () => {
      const uint16 = new Uint16Array([256, 512])
      const result = schema.safeParse(uint16)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBeInstanceOf(Uint8Array)
      }
    })

    it('coerces Float32Array to Uint8Array', () => {
      const float32 = new Float32Array([1.5, 2.5])
      const result = schema.safeParse(float32)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBeInstanceOf(Uint8Array)
      }
    })

    it('validates coerced TypedArray with length constraints', () => {
      const schema = bytes({ minLength: 2, maxLength: 10 })
      const int16 = new Int16Array([1, 2, 3]) // 6 bytes
      const result = schema.safeParse(int16)
      expect(result.success).toBe(true)
    })
  })
})
