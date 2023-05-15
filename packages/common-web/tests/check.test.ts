import { check } from '../src/index'
import { ZodError } from 'zod'

describe('check', () => {
  describe('is', () => {
    it('checks object against definition', () => {
      const checkable: check.Checkable<boolean> = {
        parse(obj) {
          return Boolean(obj)
        },
        safeParse(obj) {
          return {
            success: true,
            data: Boolean(obj),
          }
        },
      }

      expect(check.is(true, checkable)).toBe(true)
    })

    it('handles failed checks', () => {
      const checkable: check.Checkable<boolean> = {
        parse(obj) {
          return Boolean(obj)
        },
        safeParse() {
          return {
            success: false,
            error: new ZodError([]),
          }
        },
      }

      expect(check.is(true, checkable)).toBe(false)
    })
  })

  describe('assure', () => {
    it('returns value on success', () => {
      const checkable: check.Checkable<boolean> = {
        parse(obj) {
          return Boolean(obj)
        },
        safeParse(obj) {
          return {
            success: true,
            data: Boolean(obj),
          }
        },
      }

      expect(check.assure(checkable, true)).toEqual(true)
    })

    it('throws on failure', () => {
      const err = new Error('foo')
      const checkable: check.Checkable<boolean> = {
        parse() {
          throw err
        },
        safeParse() {
          throw err
        },
      }

      expect(() => check.assure(checkable, true)).toThrow(err)
    })
  })

  describe('isObject', () => {
    const falseTestValues: unknown[] = [null, undefined, 'foo', 123, true]

    for (const obj of falseTestValues) {
      it(`returns false for ${obj}`, () => {
        expect(check.isObject(obj)).toBe(false)
      })
    }

    it('returns true for objects', () => {
      expect(check.isObject({})).toBe(true)
    })

    it('returns true for instances of classes', () => {
      const obj = new (class {})()
      expect(check.isObject(obj)).toBe(true)
    })
  })
})
