import { assert, describe, expect, it } from 'vitest'
import { ui8ConcatNode, ui8ConcatPonyfill } from './uint8array-concat.js'
import { ui8Equals } from './uint8array.js'

for (const ui8Concat of [ui8ConcatNode, ui8ConcatPonyfill] as const) {
  // Tests should run in NodeJS where implementations are available.
  assert(ui8Concat, 'ui8Concat implementation should not be undefined')

  describe(ui8Concat.name, () => {
    describe('empty array', () => {
      it('returns empty Uint8Array when given empty array', () => {
        const result = ui8Concat([])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(0)
      })
    })

    describe('single array', () => {
      it('returns copy of single Uint8Array', () => {
        const input = new Uint8Array([1, 2, 3])
        const result = ui8Concat([input])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, input)).toBe(true)
      })

      it('returns copy of single empty Uint8Array', () => {
        const input = new Uint8Array(0)
        const result = ui8Concat([input])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(0)
      })
    })

    describe('multiple arrays', () => {
      it('concatenates two arrays', () => {
        const a = new Uint8Array([1, 2, 3])
        const b = new Uint8Array([4, 5, 6])
        const result = ui8Concat([a, b])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([1, 2, 3, 4, 5, 6]))).toBe(true)
      })

      it('concatenates three arrays', () => {
        const a = new Uint8Array([1, 2])
        const b = new Uint8Array([3, 4])
        const c = new Uint8Array([5, 6])
        const result = ui8Concat([a, b, c])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([1, 2, 3, 4, 5, 6]))).toBe(true)
      })

      it('concatenates many arrays', () => {
        const arrays = [
          new Uint8Array([0x00]),
          new Uint8Array([0x01, 0x02]),
          new Uint8Array([0x03, 0x04, 0x05]),
          new Uint8Array([0x06, 0x07, 0x08, 0x09]),
          new Uint8Array([0x0a]),
        ]
        const result = ui8Concat(arrays)
        expect(result).toBeInstanceOf(Uint8Array)
        expect(
          ui8Equals(
            result,
            new Uint8Array([
              0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
            ]),
          ),
        ).toBe(true)
      })
    })

    describe('arrays with different lengths', () => {
      it('concatenates arrays of varying lengths', () => {
        const a = new Uint8Array([1])
        const b = new Uint8Array([2, 3, 4, 5, 6])
        const c = new Uint8Array([7, 8])
        const result = ui8Concat([a, b, c])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(
          ui8Equals(result, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
        ).toBe(true)
      })

      it('handles large arrays', () => {
        const size = 10000
        const a = new Uint8Array(size).fill(0xaa)
        const b = new Uint8Array(size).fill(0xbb)
        const result = ui8Concat([a, b])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(size * 2)
        // Check first array portion
        for (let i = 0; i < size; i++) {
          expect(result[i]).toBe(0xaa)
        }
        // Check second array portion
        for (let i = size; i < size * 2; i++) {
          expect(result[i]).toBe(0xbb)
        }
      })
    })

    describe('empty Uint8Arrays in input', () => {
      it('handles empty array at the beginning', () => {
        const a = new Uint8Array(0)
        const b = new Uint8Array([1, 2, 3])
        const result = ui8Concat([a, b])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([1, 2, 3]))).toBe(true)
      })

      it('handles empty array in the middle', () => {
        const a = new Uint8Array([1, 2])
        const b = new Uint8Array(0)
        const c = new Uint8Array([3, 4])
        const result = ui8Concat([a, b, c])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([1, 2, 3, 4]))).toBe(true)
      })

      it('handles empty array at the end', () => {
        const a = new Uint8Array([1, 2, 3])
        const b = new Uint8Array(0)
        const result = ui8Concat([a, b])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([1, 2, 3]))).toBe(true)
      })

      it('handles multiple empty arrays', () => {
        const a = new Uint8Array(0)
        const b = new Uint8Array([1])
        const c = new Uint8Array(0)
        const d = new Uint8Array([2])
        const e = new Uint8Array(0)
        const result = ui8Concat([a, b, c, d, e])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([1, 2]))).toBe(true)
      })

      it('handles all empty arrays', () => {
        const a = new Uint8Array(0)
        const b = new Uint8Array(0)
        const c = new Uint8Array(0)
        const result = ui8Concat([a, b, c])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBe(0)
      })
    })

    describe('byte value preservation', () => {
      it('preserves all byte values from 0x00 to 0xff', () => {
        const allBytes = new Uint8Array(256)
        for (let i = 0; i < 256; i++) {
          allBytes[i] = i
        }
        const result = ui8Concat([allBytes])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, allBytes)).toBe(true)
      })

      it('preserves boundary byte values in concatenation', () => {
        const a = new Uint8Array([0x00, 0x01, 0x7f])
        const b = new Uint8Array([0x80, 0xfe, 0xff])
        const result = ui8Concat([a, b])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(
          ui8Equals(
            result,
            new Uint8Array([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff]),
          ),
        ).toBe(true)
      })
    })

    describe('subarray handling', () => {
      it('correctly concatenates subarrays', () => {
        const fullArray = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        const sub1 = fullArray.subarray(0, 3) // [0, 1, 2]
        const sub2 = fullArray.subarray(5, 8) // [5, 6, 7]
        const result = ui8Concat([sub1, sub2])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([0, 1, 2, 5, 6, 7]))).toBe(true)
      })

      it('correctly concatenates subarray with regular array', () => {
        const fullArray = new Uint8Array([10, 20, 30, 40, 50])
        const sub = fullArray.subarray(1, 4) // [20, 30, 40]
        const regular = new Uint8Array([100, 200])
        const result = ui8Concat([sub, regular])
        expect(result).toBeInstanceOf(Uint8Array)
        expect(ui8Equals(result, new Uint8Array([20, 30, 40, 100, 200]))).toBe(
          true,
        )
      })
    })
  })
}
