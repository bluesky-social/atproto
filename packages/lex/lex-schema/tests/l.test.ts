import { describe, expect, it } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import { l } from '../src/index.js'

// await cidForRawBytes(Buffer.from('Hello, World!'))
const blobCid = parseCid(
  'bafkreig77vqcdozl2wyk6z3cscaj5q5fggi53aoh64fewkdiri3cdauyn4',
)

describe('simple schemas', () => {
  describe('l.integer', () => {
    const schema = l.integer()

    it('validates integers', () => {
      expect(schema.matches(42)).toBe(true)
    })

    it('rejects floats', () => {
      expect(schema.matches(3.14)).toBe(false)
    })

    it('rejects strings', () => {
      expect(schema.matches('42')).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.integer()).toBe(schema)
    })

    it('does not memoize with options', () => {
      // @ts-expect-error
      expect(l.integer({ unknownOption: 43 })).not.toBe(schema)
      expect(l.integer({ minimum: 0 })).not.toBe(schema)
      expect(l.integer({ minimum: 0 })).not.toBe(l.integer({ minimum: 0 }))
      expect(l.integer({ maximum: 100 })).not.toBe(l.integer({ maximum: 100 }))
    })
  })

  describe('l.string', () => {
    const schema = l.string()

    it('validates strings', () => {
      expect(schema.matches('hello')).toBe(true)
    })

    it('rejects numbers', () => {
      expect(schema.matches(123)).toBe(false)
    })

    it('rejects null', () => {
      expect(schema.matches(null)).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.string()).toBe(schema)
    })
  })

  describe('l.boolean', () => {
    const schema = l.boolean()

    it('validates true', () => {
      expect(schema.matches(true)).toBe(true)
    })

    it('validates false', () => {
      expect(schema.matches(false)).toBe(true)
    })

    it('rejects strings', () => {
      expect(schema.matches('true')).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.boolean()).toBe(schema)

      expect(l.optional(l.boolean())).toBe(l.optional(l.boolean()))
      expect(l.nullable(l.boolean())).toBe(l.nullable(l.boolean()))
    })
  })

  describe('l.blob', () => {
    const schema = l.blob()

    it('validates valid blob references', () => {
      expect(
        schema.matches({
          $type: 'blob',
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        }),
      ).toBe(true)
    })

    it('rejects blob without $type', () => {
      expect(
        schema.matches({
          ref: blobCid,
          mimeType: 'image/jpeg',
          size: 10000,
        }),
      ).toBe(false)
    })

    it('rejects non-objects', () => {
      expect(schema.matches('not a blob')).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.blob()).toBe(schema)
    })
  })

  describe('l.null', () => {
    const schema = l.null()

    it('validates null', () => {
      expect(schema.matches(null)).toBe(true)
    })

    it('rejects undefined', () => {
      expect(schema.matches(undefined)).toBe(false)
    })

    it('rejects strings', () => {
      expect(schema.matches('null')).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.null()).toBe(schema)
    })
  })

  describe('l.literal', () => {
    const schema = l.literal('active')

    it('validates matching literal', () => {
      expect(schema.matches('active')).toBe(true)
    })

    it('rejects non-matching value', () => {
      expect(schema.matches('inactive')).toBe(false)
    })
  })

  describe('l.enum', () => {
    const schema = l.enum(['red', 'green', 'blue'])

    it('validates enum values', () => {
      expect(schema.matches('red')).toBe(true)
      expect(schema.matches('green')).toBe(true)
      expect(schema.matches('blue')).toBe(true)
    })

    it('rejects non-enum values', () => {
      expect(schema.matches('yellow')).toBe(false)
    })
  })

  describe('l.array', () => {
    const schema = l.array(l.string())

    it('validates arrays of strings', () => {
      expect(schema.matches(['hello', 'world'])).toBe(true)
    })

    it('validates empty arrays', () => {
      expect(schema.matches([])).toBe(true)
    })

    it('rejects arrays with invalid items', () => {
      expect(schema.matches(['hello', 123])).toBe(false)
    })

    it('rejects non-arrays', () => {
      expect(schema.matches('not an array')).toBe(false)
    })
  })

  describe('l.object', () => {
    const schema = l.object({
      name: l.string(),
      age: l.integer(),
    })

    it('validates valid objects', () => {
      expect(schema.matches({ name: 'Alice', age: 30 })).toBe(true)
    })

    it('rejects objects with missing properties', () => {
      expect(schema.matches({ name: 'Alice' })).toBe(false)
    })

    it('rejects objects with invalid property types', () => {
      expect(schema.matches({ name: 'Alice', age: 'thirty' })).toBe(false)
    })
  })

  describe('l.nullable', () => {
    const schema = l.nullable(l.string())

    it('validates null', () => {
      expect(schema.matches(null)).toBe(true)
    })

    it('validates wrapped type', () => {
      expect(schema.matches('hello')).toBe(true)
    })

    it('rejects invalid types', () => {
      expect(schema.matches(123)).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.nullable(l.string())).toBe(schema)
    })
  })

  describe('l.optional', () => {
    const schema = l.optional(l.string())

    it('validates undefined', () => {
      expect(schema.matches(undefined)).toBe(true)
    })

    it('validates wrapped type', () => {
      expect(schema.matches('hello')).toBe(true)
    })

    it('rejects null', () => {
      expect(schema.matches(null)).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.optional(l.string())).toBe(schema)
    })
  })

  describe('l.unknown', () => {
    const schema = l.unknown()

    it('validates any value', () => {
      expect(schema.matches('string')).toBe(true)
      expect(schema.matches(123)).toBe(true)
      expect(schema.matches(null)).toBe(true)
      expect(schema.matches({ key: 'value' })).toBe(true)
    })

    it('memoizes instances', () => {
      expect(l.unknown()).toBe(schema)
    })
  })

  describe('l.never', () => {
    const schema = l.never()

    it('rejects all values', () => {
      expect(schema.matches('string')).toBe(false)
      expect(schema.matches(123)).toBe(false)
      expect(schema.matches(null)).toBe(false)
      expect(schema.matches(undefined)).toBe(false)
    })

    it('memoizes instances', () => {
      expect(l.never()).toBe(schema)
      expect(l.never()).toBe(schema)
      expect(l.never()).toBe(schema)
    })
  })
})

describe('complex schemas', () => {
  const addressSchema = l.object({
    street: l.string(),
    city: l.string(),
    zipCode: l.integer(),
  })

  const mobilityPreferenceSchema = l.discriminatedUnion('type', [
    l.object({
      type: l.literal('car'),
      carModel: l.string(),
    }),
    l.object({
      type: l.literal('bike'),
      bikeType: l.string(),
    }),
    l.object({
      type: l.literal('public_transport'),
      preferredLines: l.array(l.string()),
    }),
  ])

  const userSchema = l.object({
    id: l.integer(),
    name: l.string(),
    gender: l.optional(l.nullable(l.enum(['male', 'female']))),
    address: addressSchema,
    mobilityPreferences: l.optional(l.array(mobilityPreferenceSchema)),
    parent: l.optional(l.ref((() => userSchema) as any)),
  })

  describe('addressSchema', () => {
    it('validates valid address', () => {
      const result = addressSchema.safeParse({
        street: '123 Main St',
        city: 'Springfield',
        zipCode: 12345,
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing required field', () => {
      const result = addressSchema.safeParse({
        street: '123 Main St',
        city: 'Springfield',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid field type', () => {
      const result = addressSchema.safeParse({
        street: '123 Main St',
        city: 'Springfield',
        zipCode: '12345',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('mobilityPreferenceSchema (discriminatedUnion)', () => {
    it('validates car preference', () => {
      const result = mobilityPreferenceSchema.safeParse({
        type: 'car',
        carModel: 'Tesla Model 3',
      })
      expect(result.success).toBe(true)
    })

    it('validates bike preference', () => {
      const result = mobilityPreferenceSchema.safeParse({
        type: 'bike',
        bikeType: 'mountain',
      })
      expect(result.success).toBe(true)
    })

    it('validates public transport preference', () => {
      const result = mobilityPreferenceSchema.safeParse({
        type: 'public_transport',
        preferredLines: ['Line 1', 'Line 2'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid discriminator value', () => {
      const result = mobilityPreferenceSchema.safeParse({
        type: 'helicopter',
        model: 'Apache',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing discriminator', () => {
      const result = mobilityPreferenceSchema.safeParse({
        carModel: 'Tesla Model 3',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('userSchema', () => {
    const validUser = {
      id: 1,
      name: 'Alice',
      address: {
        street: '123 Main St',
        city: 'Springfield',
        zipCode: 12345,
      },
    }

    it('validates minimal valid user', () => {
      const result = userSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('validates user with optional gender', () => {
      const result = userSchema.safeParse({
        ...validUser,
        gender: 'female',
      })
      expect(result.success).toBe(true)
    })

    it('validates user with null gender', () => {
      const result = userSchema.safeParse({
        ...validUser,
        gender: null,
      })
      expect(result.success).toBe(true)
    })

    it('validates user with mobility preferences', () => {
      const result = userSchema.safeParse({
        ...validUser,
        mobilityPreferences: [
          { type: 'car', carModel: 'Tesla' },
          { type: 'bike', bikeType: 'road' },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('validates user with parent reference', () => {
      const result = userSchema.safeParse({
        ...validUser,
        parent: {
          id: 2,
          name: 'Bob',
          address: {
            street: '456 Oak Ave',
            city: 'Springfield',
            zipCode: 12346,
          },
        },
      })
      expect(result.success).toBe(true)
    })

    it('rejects user with invalid gender', () => {
      const result = userSchema.safeParse({
        ...validUser,
        gender: 'other',
      })
      expect(result.success).toBe(false)
    })

    it('rejects user with missing required field', () => {
      const result = userSchema.safeParse({
        id: 1,
        name: 'Alice',
      })
      expect(result.success).toBe(false)
    })

    it('rejects user with invalid mobility preference', () => {
      const result = userSchema.safeParse({
        ...validUser,
        mobilityPreferences: [{ type: 'invalid', data: 'test' }],
      })
      expect(result.success).toBe(false)
    })
  })
})
