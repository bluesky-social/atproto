import { describe, expect, it, vi } from 'vitest'
import { IssueCustom } from '../core.js'
import { custom } from './custom.js'

describe('CustomSchema', () => {
  describe('basic validation', () => {
    it('validates input that passes custom assertion', () => {
      const schema = custom(
        (input): input is string => typeof input === 'string',
        'Must be a string',
      )
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('rejects input that fails custom assertion', () => {
      const schema = custom(
        (input): input is string => typeof input === 'string',
        'Must be a string',
      )
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('includes custom message in error', () => {
      const schema = custom(
        (input): input is string => typeof input === 'string',
        'Custom error message',
      )
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.reason.message).toContain('Custom error message')
      }
    })
  })

  describe('complex type guards', () => {
    it('validates objects with specific properties', () => {
      interface User {
        name: string
        age: number
      }

      const schema = custom((input): input is User => {
        return (
          typeof input === 'object' &&
          input !== null &&
          'name' in input &&
          'age' in input &&
          typeof (input as any).name === 'string' &&
          typeof (input as any).age === 'number'
        )
      }, 'Must be a valid User object')

      expect(schema.matches({ name: 'Alice', age: 30 })).toBe(true)
    })

    it('rejects objects missing required properties', () => {
      interface User {
        name: string
        age: number
      }

      const schema = custom((input): input is User => {
        return (
          typeof input === 'object' &&
          input !== null &&
          'name' in input &&
          'age' in input &&
          typeof (input as any).name === 'string' &&
          typeof (input as any).age === 'number'
        )
      }, 'Must be a valid User object')

      expect(schema.matches({ name: 'Alice' })).toBe(false)
    })

    it('validates arrays with specific element types', () => {
      const schema = custom((input): input is number[] => {
        return (
          Array.isArray(input) &&
          input.every((item) => typeof item === 'number')
        )
      }, 'Must be an array of numbers')

      const result = schema.safeParse([1, 2, 3, 4])
      expect(result.success).toBe(true)
    })

    it('rejects arrays with mixed types', () => {
      const schema = custom((input): input is number[] => {
        return (
          Array.isArray(input) &&
          input.every((item) => typeof item === 'number')
        )
      }, 'Must be an array of numbers')

      const result = schema.safeParse([1, 'two', 3])
      expect(result.success).toBe(false)
    })
  })

  describe('custom context usage', () => {
    it('can add custom issues through context', () => {
      const schema = custom((input, ctx): input is string => {
        if (typeof input !== 'string') {
          ctx.addIssue({
            code: 'invalid_type',
            path: ctx.path,
            input,
            expected: ['string'],
          } as any)
          return false
        }
        return true
      }, 'Must be a string')

      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('accesses path from context', () => {
      let capturedPath: any[] = []
      const schema = custom((input, ctx): input is string => {
        capturedPath = [...ctx.path]
        return typeof input === 'string'
      }, 'Must be a string')

      schema.safeParse('test')
      expect(capturedPath).toEqual([])
    })

    it('validates with custom path', () => {
      const schema = custom(
        (input): input is string => typeof input === 'string',
        'Must be a string',
        'customField',
      )

      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.reason.message).toContain('customField')
      }
    })

    it('validates with array of paths', () => {
      const schema = custom(
        (input): input is string => typeof input === 'string',
        'Must be a string',
        ['nested', 'field'],
      )

      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.reason.message).toContain('nested')
        expect(result.reason.message).toContain('field')
      }
    })
  })

  describe('business logic validation', () => {
    it('validates email format', () => {
      const schema = custom((input): input is string => {
        return (
          typeof input === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
        )
      }, 'Must be a valid email address')

      const validResult = schema.safeParse('user@example.com')
      expect(validResult.success).toBe(true)

      const invalidResult = schema.safeParse('not-an-email')
      expect(invalidResult.success).toBe(false)
    })

    it('validates password strength', () => {
      const schema = custom((input): input is string => {
        if (typeof input !== 'string') return false
        return (
          input.length >= 8 &&
          /[A-Z]/.test(input) &&
          /[a-z]/.test(input) &&
          /[0-9]/.test(input)
        )
      }, 'Password must be at least 8 characters with uppercase, lowercase, and numbers')

      const validResult = schema.safeParse('MyPass123')
      expect(validResult.success).toBe(true)

      const weakResult = schema.safeParse('weak')
      expect(weakResult.success).toBe(false)
    })

    it('validates age range', () => {
      const schema = custom((input): input is number => {
        return typeof input === 'number' && input >= 18 && input <= 120
      }, 'Age must be between 18 and 120')

      const validResult = schema.safeParse(25)
      expect(validResult.success).toBe(true)

      const tooYoungResult = schema.safeParse(15)
      expect(tooYoungResult.success).toBe(false)

      const tooOldResult = schema.safeParse(150)
      expect(tooOldResult.success).toBe(false)
    })

    it('validates positive numbers', () => {
      const schema = custom((input): input is number => {
        return typeof input === 'number' && input > 0
      }, 'Must be a positive number')

      const validResult = schema.safeParse(5)
      expect(validResult.success).toBe(true)

      const zeroResult = schema.safeParse(0)
      expect(zeroResult.success).toBe(false)

      const negativeResult = schema.safeParse(-5)
      expect(negativeResult.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles null input', () => {
      const schema = custom(
        (input): input is null => input === null,
        'Must be null',
      )

      const validResult = schema.safeParse(null)
      expect(validResult.success).toBe(true)

      const invalidResult = schema.safeParse(undefined)
      expect(invalidResult.success).toBe(false)
    })

    it('handles undefined input', () => {
      const schema = custom(
        (input): input is undefined => input === undefined,
        'Must be undefined',
      )

      const validResult = schema.safeParse(undefined)
      expect(validResult.success).toBe(true)

      const invalidResult = schema.safeParse(null)
      expect(invalidResult.success).toBe(false)
    })

    it('handles empty string', () => {
      const schema = custom(
        (input): input is string =>
          typeof input === 'string' && input.length > 0,
        'Must be a non-empty string',
      )

      const validResult = schema.safeParse('hello')
      expect(validResult.success).toBe(true)

      const invalidResult = schema.safeParse('')
      expect(invalidResult.success).toBe(false)
    })

    it('handles empty array', () => {
      const schema = custom(
        (input): input is any[] => Array.isArray(input) && input.length > 0,
        'Must be a non-empty array',
      )

      const validResult = schema.safeParse([1, 2, 3])
      expect(validResult.success).toBe(true)

      const invalidResult = schema.safeParse([])
      expect(invalidResult.success).toBe(false)
    })

    it('handles complex nested structures', () => {
      interface ComplexType {
        users: Array<{ name: string; email: string }>
        metadata: { count: number }
      }

      const schema = custom((input): input is ComplexType => {
        if (typeof input !== 'object' || input === null) return false
        const obj = input as any
        return (
          Array.isArray(obj.users) &&
          obj.users.every(
            (u: any) =>
              typeof u === 'object' &&
              typeof u.name === 'string' &&
              typeof u.email === 'string',
          ) &&
          typeof obj.metadata === 'object' &&
          typeof obj.metadata.count === 'number'
        )
      }, 'Must be a valid complex structure')

      const validResult = schema.safeParse({
        users: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
        metadata: { count: 2 },
      })
      expect(validResult.success).toBe(true)

      const invalidResult = schema.safeParse({
        users: [{ name: 'Alice' }], // missing email
        metadata: { count: 1 },
      })
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('type narrowing', () => {
    it('correctly narrows union types', () => {
      type StringOrNumber = string | number

      const schema = custom(
        (input): input is string => typeof input === 'string',
        'Must be a string',
      )

      const input: StringOrNumber = 'hello'

      const result = schema.safeParse(input)
      expect(result.success).toBe(true)

      if (result.success) {
        // Type should be narrowed to string
        const value: string = result.value
        expect(typeof value).toBe('string')
      }
    })

    it('validates discriminated unions', () => {
      type Shape =
        | { type: 'circle'; radius: number }
        | { type: 'rectangle'; width: number; height: number }

      const circleSchema = custom((input): input is Shape => {
        return (
          typeof input === 'object' &&
          input !== null &&
          'type' in input &&
          (input as any).type === 'circle' &&
          'radius' in input &&
          typeof (input as any).radius === 'number'
        )
      }, 'Must be a valid circle')

      const validResult = circleSchema.safeParse({ type: 'circle', radius: 5 })
      expect(validResult.success).toBe(true)

      const invalidResult = circleSchema.safeParse({
        type: 'rectangle',
        width: 10,
        height: 20,
      })
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('assertion context behavior', () => {
    it('calls assertion with null as this', () => {
      const assertion = vi.fn(function (
        this: unknown,
        input: unknown,
      ): input is string {
        expect(this).toBeNull()
        return typeof input === 'string'
      })

      custom(assertion as any, 'Must be a string').safeParse('test')

      expect(assertion).toHaveBeenCalledTimes(1)
    })

    it('provides addIssue method in context', () => {
      const schema = custom((input, ctx): input is string => {
        ctx.addIssue(new IssueCustom(ctx.path, input, 'This is a custom issue'))
        return false
      }, 'Must be a string')

      expect(schema.safeParse('test')).toMatchObject({
        success: false,
        reason: {
          issues: [
            { message: 'This is a custom issue' },
            { message: 'Must be a string' },
          ],
        },
      })
    })

    it('provides path array in context', () => {
      const schema = custom((input, ctx): input is string => {
        expect(Array.isArray(ctx.path)).toBe(true)
        return typeof input === 'string'
      }, 'Must be a string')

      schema.safeParse('test')
    })
  })
})
