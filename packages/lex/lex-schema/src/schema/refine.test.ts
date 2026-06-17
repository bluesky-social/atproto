import { describe, expect, it } from 'vitest'
import { integer } from './integer.js'
import { object } from './object.js'
import { refine } from './refine.js'
import { string } from './string.js'

describe('refine', () => {
  describe('basic refinement checks', () => {
    const schema = refine(integer(), {
      check: (value) => value > 0,
      message: 'Value must be positive',
    })

    it('validates values that pass the refinement check', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects values that fail the refinement check', () => {
      const result = schema.safeParse(-5)
      expect(result.success).toBe(false)
    })

    it('rejects zero when check requires positive', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('still validates base schema constraints', () => {
      const result = schema.safeParse('not a number')
      expect(result.success).toBe(false)
    })
  })

  describe('refinement with type assertions', () => {
    const schema = refine(integer(), {
      check: (value): value is 42 => value === 42,
      message: 'Value must be 42',
    })

    it('validates values that pass the type assertion', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects values that fail the type assertion', () => {
      const result = schema.safeParse(43)
      expect(result.success).toBe(false)
    })
  })

  describe('refinement with string schema', () => {
    const schema = refine(string(), {
      check: (value) => value.includes('@'),
      message: 'String must contain @ symbol',
    })

    it('validates strings that pass the refinement check', () => {
      const result = schema.safeParse('user@example.com')
      expect(result.success).toBe(true)
    })

    it('rejects strings that fail the refinement check', () => {
      const result = schema.safeParse('userexample.com')
      expect(result.success).toBe(false)
    })

    it('rejects non-strings before refinement check', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })
  })

  describe('refinement with base schema constraints', () => {
    const schema = refine(integer({ minimum: 0, maximum: 100 }), {
      check: (value) => value % 2 === 0,
      message: 'Value must be even',
    })

    it('validates values that pass both base constraints and refinement', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects values that fail base constraints', () => {
      const result = schema.safeParse(150)
      expect(result.success).toBe(false)
    })

    it('rejects values that pass base constraints but fail refinement', () => {
      const result = schema.safeParse(43)
      expect(result.success).toBe(false)
    })

    it('rejects values that fail both base constraints and refinement', () => {
      const result = schema.safeParse(-5)
      expect(result.success).toBe(false)
    })
  })

  describe('multiple refinements chained', () => {
    const schema = refine(
      refine(integer(), {
        check: (value) => value > 0,
        message: 'Value must be positive',
      }),
      {
        check: (value) => value < 100,
        message: 'Value must be less than 100',
      },
    )

    it('validates values that pass all refinements', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects values that fail first refinement', () => {
      const result = schema.safeParse(-5)
      expect(result.success).toBe(false)
    })

    it('rejects values that fail second refinement', () => {
      const result = schema.safeParse(150)
      expect(result.success).toBe(false)
    })

    it('accepts values at the boundary of both refinements', () => {
      const result1 = schema.safeParse(1)
      expect(result1.success).toBe(true)

      const result2 = schema.safeParse(99)
      expect(result2.success).toBe(true)
    })
  })

  describe('refinement with custom path', () => {
    const schema = refine(integer(), {
      check: (value) => value > 0,
      message: 'Value must be positive',
      path: 'customField',
    })

    it('validates values that pass the refinement', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects values that fail the refinement', () => {
      const result = schema.safeParse(-5)
      expect(result.success).toBe(false)
    })
  })

  describe('refinement with array path', () => {
    const schema = refine(integer(), {
      check: (value) => value > 0,
      message: 'Value must be positive',
      path: ['nested', 'field'],
    })

    it('validates values that pass the refinement', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects values that fail the refinement', () => {
      const result = schema.safeParse(-5)
      expect(result.success).toBe(false)
    })
  })

  describe('refinement on object properties', () => {
    const schema = object({
      age: refine(integer(), {
        check: (value) => value >= 18,
        message: 'Age must be at least 18',
      }),
      email: refine(string(), {
        check: (value) => value.includes('@'),
        message: 'Email must contain @ symbol',
      }),
    })

    it('validates objects with properties that pass refinements', () => {
      const result = schema.safeParse({
        age: 25,
        email: 'user@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('rejects objects with age below minimum', () => {
      const result = schema.safeParse({
        age: 16,
        email: 'user@example.com',
      })
      expect(result.success).toBe(false)
    })

    it('rejects objects with invalid email', () => {
      const result = schema.safeParse({
        age: 25,
        email: 'userexample.com',
      })
      expect(result.success).toBe(false)
    })

    it('rejects objects with both properties failing refinements', () => {
      const result = schema.safeParse({
        age: 16,
        email: 'userexample.com',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('complex refinement logic', () => {
    const schema = refine(string(), {
      check: (value) => {
        const hasLowerCase = /[a-z]/.test(value)
        const hasUpperCase = /[A-Z]/.test(value)
        const hasNumber = /[0-9]/.test(value)
        return hasLowerCase && hasUpperCase && hasNumber
      },
      message: 'Password must contain lowercase, uppercase, and numbers',
    })

    it('validates strings that meet all password requirements', () => {
      const result = schema.safeParse('Password123')
      expect(result.success).toBe(true)
    })

    it('rejects strings without lowercase', () => {
      const result = schema.safeParse('PASSWORD123')
      expect(result.success).toBe(false)
    })

    it('rejects strings without uppercase', () => {
      const result = schema.safeParse('password123')
      expect(result.success).toBe(false)
    })

    it('rejects strings without numbers', () => {
      const result = schema.safeParse('Password')
      expect(result.success).toBe(false)
    })

    it('rejects empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('refinement with comparison logic', () => {
    const schema = refine(integer(), {
      check: (value) => {
        // Check if value is a prime number
        if (value <= 1) return false
        if (value <= 3) return true
        if (value % 2 === 0 || value % 3 === 0) return false
        for (let i = 5; i * i <= value; i += 6) {
          if (value % i === 0 || value % (i + 2) === 0) return false
        }
        return true
      },
      message: 'Value must be a prime number',
    })

    it('validates prime numbers', () => {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]
      primes.forEach((prime) => {
        const result = schema.safeParse(prime)
        expect(result.success).toBe(true)
      })
    })

    it('rejects non-prime numbers', () => {
      const nonPrimes = [0, 1, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20]
      nonPrimes.forEach((nonPrime) => {
        const result = schema.safeParse(nonPrime)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('refinement with string length logic', () => {
    const schema = refine(string({ minLength: 1, maxLength: 50 }), {
      check: (value) => value.trim().length > 0,
      message: 'String must not be only whitespace',
    })

    it('validates non-empty trimmed strings', () => {
      const result = schema.safeParse('hello world')
      expect(result.success).toBe(true)
    })

    it('validates strings with leading/trailing whitespace', () => {
      const result = schema.safeParse('  hello  ')
      expect(result.success).toBe(true)
    })

    it('rejects strings with only whitespace', () => {
      const result = schema.safeParse('     ')
      expect(result.success).toBe(false)
    })

    it('rejects single space', () => {
      const result = schema.safeParse(' ')
      expect(result.success).toBe(false)
    })

    it('rejects tabs and newlines only', () => {
      const result = schema.safeParse('\t\n  ')
      expect(result.success).toBe(false)
    })
  })

  describe('refinement preserves original schema', () => {
    const originalSchema = integer({ minimum: 0 })
    const refinedSchema = refine(originalSchema, {
      check: (value) => value % 2 === 0,
      message: 'Value must be even',
    })

    it('original schema still works independently', () => {
      const result = originalSchema.safeParse(5)
      expect(result.success).toBe(true)
    })

    it('refined schema has additional constraint', () => {
      const result = refinedSchema.safeParse(5)
      expect(result.success).toBe(false)
    })

    it('refined schema inherits base constraints', () => {
      const result1 = refinedSchema.safeParse(-2)
      expect(result1.success).toBe(false)

      const result2 = refinedSchema.safeParse(4)
      expect(result2.success).toBe(true)
    })
  })

  describe('refinement with boundary conditions', () => {
    const schema = refine(integer({ minimum: 0, maximum: 100 }), {
      check: (value) => value !== 50,
      message: 'Value must not be 50',
    })

    it('validates values at lower boundary', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('validates values at upper boundary', () => {
      const result = schema.safeParse(100)
      expect(result.success).toBe(true)
    })

    it('rejects the specific excluded value', () => {
      const result = schema.safeParse(50)
      expect(result.success).toBe(false)
    })

    it('validates values around the excluded value', () => {
      const result1 = schema.safeParse(49)
      expect(result1.success).toBe(true)

      const result2 = schema.safeParse(51)
      expect(result2.success).toBe(true)
    })
  })

  describe('refinement with regex patterns', () => {
    const schema = refine(string(), {
      check: (value) => /^[A-Z][a-zA-Z0-9]*$/.test(value),
      message: 'Must start with uppercase letter',
    })

    it('validates strings starting with uppercase', () => {
      const result = schema.safeParse('Hello123')
      expect(result.success).toBe(true)
    })

    it('rejects strings starting with lowercase', () => {
      const result = schema.safeParse('hello123')
      expect(result.success).toBe(false)
    })

    it('rejects strings starting with number', () => {
      const result = schema.safeParse('123Hello')
      expect(result.success).toBe(false)
    })

    it('rejects strings starting with special character', () => {
      const result = schema.safeParse('_Hello')
      expect(result.success).toBe(false)
    })

    it('validates single uppercase letter', () => {
      const result = schema.safeParse('A')
      expect(result.success).toBe(true)
    })
  })

  describe('refinement with custom error messages', () => {
    const schema = refine(integer(), {
      check: (value) => value >= 1 && value <= 10,
      message: 'Value must be between 1 and 10 (inclusive)',
    })

    it('validates values within range', () => {
      const result = schema.safeParse(5)
      expect(result.success).toBe(true)
    })

    it('rejects values outside range', () => {
      const result = schema.safeParse(11)
      expect(result.success).toBe(false)
    })

    it('rejects zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles refinement that always returns true', () => {
      const schema = refine(integer(), {
        check: () => true,
        message: 'This should never fail',
      })
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('handles refinement that always returns false', () => {
      const schema = refine(integer(), {
        check: () => false,
        message: 'This always fails',
      })
      const result = schema.safeParse(42)
      expect(result.success).toBe(false)
    })

    it('handles empty string refinement', () => {
      const schema = refine(string(), {
        check: (value) => value === '',
        message: 'Value must be empty string',
      })
      const result1 = schema.safeParse('')
      expect(result1.success).toBe(true)

      const result2 = schema.safeParse('hello')
      expect(result2.success).toBe(false)
    })

    it('handles zero value refinement', () => {
      const schema = refine(integer(), {
        check: (value) => value === 0,
        message: 'Value must be zero',
      })
      const result1 = schema.safeParse(0)
      expect(result1.success).toBe(true)

      const result2 = schema.safeParse(1)
      expect(result2.success).toBe(false)
    })

    it('handles negative value refinement', () => {
      const schema = refine(integer(), {
        check: (value) => value < 0,
        message: 'Value must be negative',
      })
      const result1 = schema.safeParse(-5)
      expect(result1.success).toBe(true)

      const result2 = schema.safeParse(5)
      expect(result2.success).toBe(false)
    })
  })

  describe('refinement with combined string constraints', () => {
    const schema = refine(string({ minLength: 8, maxLength: 20 }), {
      check: (value) => {
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value)
        const hasLetter = /[a-zA-Z]/.test(value)
        return hasSpecialChar && hasLetter
      },
      message: 'Must contain letters and special characters',
    })

    it('validates strings meeting all requirements', () => {
      const result = schema.safeParse('Hello@World!')
      expect(result.success).toBe(true)
    })

    it('rejects strings too short', () => {
      const result = schema.safeParse('Hi@!')
      expect(result.success).toBe(false)
    })

    it('rejects strings without special characters', () => {
      const result = schema.safeParse('HelloWorld')
      expect(result.success).toBe(false)
    })

    it('rejects strings without letters', () => {
      const result = schema.safeParse('12345!@#$%')
      expect(result.success).toBe(false)
    })

    it('validates strings at minimum length with requirements', () => {
      const result = schema.safeParse('Hello@12')
      expect(result.success).toBe(true)
    })
  })

  describe('refinement inheritance', () => {
    const baseSchema = integer({ minimum: 0, maximum: 1000 })
    const refinedOnce = refine(baseSchema, {
      check: (value) => value % 10 === 0,
      message: 'Must be divisible by 10',
    })
    const refinedTwice = refine(refinedOnce, {
      check: (value) => value % 100 === 0,
      message: 'Must be divisible by 100',
    })

    it('validates with all inherited constraints', () => {
      const result = refinedTwice.safeParse(500)
      expect(result.success).toBe(true)
    })

    it('rejects when failing base constraint', () => {
      const result = refinedTwice.safeParse(1500)
      expect(result.success).toBe(false)
    })

    it('rejects when failing first refinement', () => {
      const result = refinedTwice.safeParse(505)
      expect(result.success).toBe(false)
    })

    it('rejects when failing second refinement', () => {
      const result = refinedTwice.safeParse(50)
      expect(result.success).toBe(false)
    })
  })

  describe('refinement with string format validation', () => {
    const schema = refine(string({ format: 'uri' }), {
      check: (value) => value.startsWith('https://'),
      message: 'Must be HTTPS URI',
    })

    it('validates HTTPS URIs', () => {
      const result = schema.safeParse('https://example.com')
      expect(result.success).toBe(true)
    })

    it('rejects HTTP URIs', () => {
      const result = schema.safeParse('http://example.com')
      expect(result.success).toBe(false)
    })

    it('rejects other valid URIs', () => {
      const result = schema.safeParse('ftp://example.com')
      expect(result.success).toBe(false)
    })

    it('rejects invalid URIs', () => {
      const result = schema.safeParse('not a uri')
      expect(result.success).toBe(false)
    })
  })
})
