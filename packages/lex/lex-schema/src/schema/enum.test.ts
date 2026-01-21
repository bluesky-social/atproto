import { describe, expect, it } from 'vitest'
import { enumSchema } from './enum.js'
import { withDefault } from './with-default.js'

describe('EnumSchema', () => {
  describe('with string values', () => {
    const schema = enumSchema(['male', 'female', 'other'])

    it('validates matching string values', () => {
      const result = schema.safeParse('male')
      expect(result.success).toBe(true)
    })

    it('validates all enum values', () => {
      expect(schema.safeParse('male').success).toBe(true)
      expect(schema.safeParse('female').success).toBe(true)
      expect(schema.safeParse('other').success).toBe(true)
    })

    it('rejects non-matching string values', () => {
      const result = schema.safeParse('unknown')
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

    it('rejects numbers', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects objects', () => {
      const result = schema.safeParse({ value: 'male' })
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse(['male'])
      expect(result.success).toBe(false)
    })

    it('rejects empty string when not in enum', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('with number values', () => {
    const schema = enumSchema([1, 2, 3])

    it('validates matching number values', () => {
      const result = schema.safeParse(1)
      expect(result.success).toBe(true)
    })

    it('validates all enum values', () => {
      expect(schema.safeParse(1).success).toBe(true)
      expect(schema.safeParse(2).success).toBe(true)
      expect(schema.safeParse(3).success).toBe(true)
    })

    it('rejects non-matching number values', () => {
      const result = schema.safeParse(4)
      expect(result.success).toBe(false)
    })

    it('rejects string numbers', () => {
      const result = schema.safeParse('1')
      expect(result.success).toBe(false)
    })

    it('rejects zero when not in enum', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('rejects negative numbers when not in enum', () => {
      const result = schema.safeParse(-1)
      expect(result.success).toBe(false)
    })
  })

  describe('with boolean values', () => {
    const schema = enumSchema([true, false])

    it('validates true', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
    })

    it('validates false', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(true)
    })

    it('rejects string booleans', () => {
      expect(schema.safeParse('true').success).toBe(false)
      expect(schema.safeParse('false').success).toBe(false)
    })

    it('rejects number booleans', () => {
      expect(schema.safeParse(1).success).toBe(false)
      expect(schema.safeParse(0).success).toBe(false)
    })
  })

  describe('with single boolean value', () => {
    const schema = enumSchema([true])

    it('validates true', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
    })

    it('rejects false when not in enum', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(false)
    })
  })

  describe('with null value', () => {
    const schema = enumSchema([null, 'value'])

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
    })

    it('validates other enum values', () => {
      const result = schema.safeParse('value')
      expect(result.success).toBe(true)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('with mixed type values', () => {
    const schema = enumSchema(['string', 123, true, null])

    it('validates string value', () => {
      const result = schema.safeParse('string')
      expect(result.success).toBe(true)
    })

    it('validates number value', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(true)
    })

    it('validates boolean value', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
    })

    it('validates null value', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
    })

    it('rejects non-matching values', () => {
      expect(schema.safeParse('other').success).toBe(false)
      expect(schema.safeParse(456).success).toBe(false)
      expect(schema.safeParse(false).success).toBe(false)
      expect(schema.safeParse(undefined).success).toBe(false)
    })
  })

  describe('with default option', () => {
    const schema = withDefault(enumSchema(['red', 'green', 'blue']), 'red')

    it('validates matching values', () => {
      const result = schema.safeParse('green')
      expect(result.success).toBe(true)
    })

    it('uses default when input is undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('red')
      }
    })

    it('uses default when no argument is passed', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('red')
      }
    })

    it('does not use default for null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('does not use default for invalid values', () => {
      const result = schema.safeParse('yellow')
      expect(result.success).toBe(false)
    })

    it('does not use default for empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('with default option as number', () => {
    const schema = withDefault(enumSchema([1, 2, 3]), 1)

    it('uses default when input is undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(1)
      }
    })

    it('does not use default for zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })
  })

  describe('with default option as boolean', () => {
    const schema = withDefault(enumSchema([true, false]), false)

    it('uses default when input is undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })

    it('validates true even when default is false', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })
  })

  describe('with default option as null', () => {
    const schema = withDefault(enumSchema([null, 'value']), null)

    it('uses default when input is undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('validates explicit null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })
  })

  describe('with single value', () => {
    const schema = enumSchema(['only'])

    it('validates the single value', () => {
      const result = schema.safeParse('only')
      expect(result.success).toBe(true)
    })

    it('rejects any other value', () => {
      expect(schema.safeParse('other').success).toBe(false)
      expect(schema.safeParse('').success).toBe(false)
      expect(schema.safeParse(null).success).toBe(false)
      expect(schema.safeParse(undefined).success).toBe(false)
    })
  })

  describe('with empty string value', () => {
    const schema = enumSchema(['', 'value'])

    it('validates empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('validates other values', () => {
      const result = schema.safeParse('value')
      expect(result.success).toBe(true)
    })

    it('rejects non-matching values', () => {
      const result = schema.safeParse('other')
      expect(result.success).toBe(false)
    })
  })

  describe('with zero value', () => {
    const schema = enumSchema([0, 1, 2])

    it('validates zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('validates other values', () => {
      expect(schema.safeParse(1).success).toBe(true)
      expect(schema.safeParse(2).success).toBe(true)
    })

    it('rejects false even though zero is in enum', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(false)
    })
  })

  describe('case sensitivity', () => {
    const schema = enumSchema(['Value', 'VALUE', 'value'])

    it('validates exact case matches', () => {
      expect(schema.safeParse('Value').success).toBe(true)
      expect(schema.safeParse('VALUE').success).toBe(true)
      expect(schema.safeParse('value').success).toBe(true)
    })

    it('rejects case mismatches', () => {
      expect(schema.safeParse('vaLue').success).toBe(false)
      expect(schema.safeParse('VaLuE').success).toBe(false)
    })
  })

  describe('with special string values', () => {
    const schema = enumSchema([
      'with space',
      'with\ttab',
      'with\nnewline',
      '123',
      'true',
      'null',
      'undefined',
    ])

    it('validates strings with spaces', () => {
      const result = schema.safeParse('with space')
      expect(result.success).toBe(true)
    })

    it('validates strings with tabs', () => {
      const result = schema.safeParse('with\ttab')
      expect(result.success).toBe(true)
    })

    it('validates strings with newlines', () => {
      const result = schema.safeParse('with\nnewline')
      expect(result.success).toBe(true)
    })

    it('validates number-like strings', () => {
      const result = schema.safeParse('123')
      expect(result.success).toBe(true)
    })

    it('rejects actual numbers for number-like strings', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('validates keyword strings', () => {
      expect(schema.safeParse('true').success).toBe(true)
      expect(schema.safeParse('null').success).toBe(true)
      expect(schema.safeParse('undefined').success).toBe(true)
    })

    it('rejects actual boolean/null/undefined for keyword strings', () => {
      expect(schema.safeParse(true).success).toBe(false)
      expect(schema.safeParse(null).success).toBe(false)
      expect(schema.safeParse(undefined).success).toBe(false)
    })
  })
})
