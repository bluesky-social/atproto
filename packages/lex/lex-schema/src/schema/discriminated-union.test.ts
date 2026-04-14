import { describe, expect, it } from 'vitest'
import { discriminatedUnion } from './discriminated-union.js'
import { enumSchema } from './enum.js'
import { integer } from './integer.js'
import { literal } from './literal.js'
import { object } from './object.js'
import { string } from './string.js'

describe('DiscriminatedUnionSchema', () => {
  describe('with literal discriminators', () => {
    const schema = discriminatedUnion('type', [
      object({
        type: literal('cat'),
        meow: string(),
      }),
      object({
        type: literal('dog'),
        bark: string(),
      }),
    ])

    it('validates first variant', () => {
      const result = schema.safeParse({
        type: 'cat',
        meow: 'meow',
      })
      expect(result.success).toBe(true)
    })

    it('validates second variant', () => {
      const result = schema.safeParse({
        type: 'dog',
        bark: 'woof',
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-objects', () => {
      const result = schema.safeParse('not an object')
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

    it('rejects arrays', () => {
      const result = schema.safeParse([{ type: 'cat', meow: 'meow' }])
      expect(result.success).toBe(false)
    })

    it('rejects objects missing discriminator', () => {
      const result = schema.safeParse({
        meow: 'meow',
      })
      expect(result.success).toBe(false)
    })

    it('rejects objects with invalid discriminator value', () => {
      const result = schema.safeParse({
        type: 'bird',
        chirp: 'tweet',
      })
      expect(result.success).toBe(false)
    })

    it('rejects objects with valid discriminator but invalid properties', () => {
      const result = schema.safeParse({
        type: 'cat',
        meow: 123,
      })
      expect(result.success).toBe(false)
    })

    it('rejects objects with valid discriminator but missing required properties', () => {
      const result = schema.safeParse({
        type: 'cat',
      })
      expect(result.success).toBe(false)
    })

    it('allows extra properties', () => {
      const result = schema.safeParse({
        type: 'cat',
        meow: 'meow',
        extra: 'property',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('with enum discriminators', () => {
    const schema = discriminatedUnion('status', [
      object({
        status: enumSchema(['pending', 'processing']),
        progress: integer(),
      }),
      object({
        status: enumSchema(['complete', 'failed']),
        result: string(),
      }),
    ])

    it('validates first variant with first enum value', () => {
      const result = schema.safeParse({
        status: 'pending',
        progress: 0,
      })
      expect(result.success).toBe(true)
    })

    it('validates first variant with second enum value', () => {
      const result = schema.safeParse({
        status: 'processing',
        progress: 50,
      })
      expect(result.success).toBe(true)
    })

    it('validates second variant with first enum value', () => {
      const result = schema.safeParse({
        status: 'complete',
        result: 'success',
      })
      expect(result.success).toBe(true)
    })

    it('validates second variant with second enum value', () => {
      const result = schema.safeParse({
        status: 'failed',
        result: 'error',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid discriminator value', () => {
      const result = schema.safeParse({
        status: 'unknown',
        progress: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects object missing discriminator', () => {
      const result = schema.safeParse({
        progress: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects object with valid discriminator but wrong properties', () => {
      const result = schema.safeParse({
        status: 'pending',
        result: 'success',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with mixed literal and enum discriminators', () => {
    const schema = discriminatedUnion('kind', [
      object({
        kind: literal('simple'),
        value: string(),
      }),
      object({
        kind: enumSchema(['complex', 'advanced']),
        value: integer(),
      }),
    ])

    it('validates literal discriminator variant', () => {
      const result = schema.safeParse({
        kind: 'simple',
        value: 'text',
      })
      expect(result.success).toBe(true)
    })

    it('validates enum discriminator variant with first value', () => {
      const result = schema.safeParse({
        kind: 'complex',
        value: 42,
      })
      expect(result.success).toBe(true)
    })

    it('validates enum discriminator variant with second value', () => {
      const result = schema.safeParse({
        kind: 'advanced',
        value: 100,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid discriminator value', () => {
      const result = schema.safeParse({
        kind: 'unknown',
        value: 'test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with single variant', () => {
    const schema = discriminatedUnion('type', [
      object({
        type: literal('only'),
        value: string(),
      }),
    ])

    it('validates the single variant', () => {
      const result = schema.safeParse({
        type: 'only',
        value: 'test',
      })
      expect(result.success).toBe(true)
    })

    it('rejects other discriminator values', () => {
      const result = schema.safeParse({
        type: 'other',
        value: 'test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with three variants', () => {
    const schema = discriminatedUnion('shape', [
      object({
        shape: literal('circle'),
        radius: integer(),
      }),
      object({
        shape: literal('square'),
        side: integer(),
      }),
      object({
        shape: literal('rectangle'),
        width: integer(),
        height: integer(),
      }),
    ])

    it('validates first variant', () => {
      const result = schema.safeParse({
        shape: 'circle',
        radius: 10,
      })
      expect(result.success).toBe(true)
    })

    it('validates second variant', () => {
      const result = schema.safeParse({
        shape: 'square',
        side: 5,
      })
      expect(result.success).toBe(true)
    })

    it('validates third variant', () => {
      const result = schema.safeParse({
        shape: 'rectangle',
        width: 10,
        height: 20,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid discriminator', () => {
      const result = schema.safeParse({
        shape: 'triangle',
        sides: 3,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with number discriminators', () => {
    const schema = discriminatedUnion('version', [
      object({
        version: literal(1),
        oldFormat: string(),
      }),
      object({
        version: literal(2),
        newFormat: string(),
      }),
    ])

    it('validates first version', () => {
      const result = schema.safeParse({
        version: 1,
        oldFormat: 'data',
      })
      expect(result.success).toBe(true)
    })

    it('validates second version', () => {
      const result = schema.safeParse({
        version: 2,
        newFormat: 'data',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid version number', () => {
      const result = schema.safeParse({
        version: 3,
        format: 'data',
      })
      expect(result.success).toBe(false)
    })

    it('rejects string version', () => {
      const result = schema.safeParse({
        version: '1',
        oldFormat: 'data',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with boolean discriminators', () => {
    const schema = discriminatedUnion('enabled', [
      object({
        enabled: literal(true),
        config: string(),
      }),
      object({
        enabled: literal(false),
        reason: string(),
      }),
    ])

    it('validates true variant', () => {
      const result = schema.safeParse({
        enabled: true,
        config: 'settings',
      })
      expect(result.success).toBe(true)
    })

    it('validates false variant', () => {
      const result = schema.safeParse({
        enabled: false,
        reason: 'disabled',
      })
      expect(result.success).toBe(true)
    })

    it('rejects string boolean', () => {
      const result = schema.safeParse({
        enabled: 'true',
        config: 'settings',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with null discriminator', () => {
    const schema = discriminatedUnion('value', [
      object({
        value: literal(null),
        empty: string(),
      }),
      object({
        value: literal('present'),
        data: string(),
      }),
    ])

    it('validates null discriminator variant', () => {
      const result = schema.safeParse({
        value: null,
        empty: 'nothing',
      })
      expect(result.success).toBe(true)
    })

    it('validates non-null discriminator variant', () => {
      const result = schema.safeParse({
        value: 'present',
        data: 'something',
      })
      expect(result.success).toBe(true)
    })

    it('rejects undefined discriminator', () => {
      const result = schema.safeParse({
        value: undefined,
        empty: 'nothing',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('constructor validation', () => {
    it('throws on overlapping literal discriminator values', () => {
      expect(() => {
        discriminatedUnion('type', [
          object({
            type: literal('duplicate'),
            a: string(),
          }),
          object({
            type: literal('duplicate'),
            b: string(),
          }),
        ])
      }).toThrow('Overlapping discriminator value: duplicate')
    })

    it('throws on overlapping enum discriminator values', () => {
      expect(() => {
        discriminatedUnion('status', [
          object({
            status: enumSchema(['active', 'pending']),
            a: string(),
          }),
          object({
            status: enumSchema(['pending', 'complete']),
            b: string(),
          }),
        ])
      }).toThrow('Overlapping discriminator value: pending')
    })

    it('throws on overlapping literal and enum discriminator values', () => {
      expect(() => {
        discriminatedUnion('kind', [
          object({
            kind: literal('test'),
            a: string(),
          }),
          object({
            kind: enumSchema(['test', 'other']),
            b: string(),
          }),
        ])
      }).toThrow('Overlapping discriminator value: test')
    })
  })

  describe('edge cases', () => {
    const schema = discriminatedUnion('type', [
      object({
        type: literal('a'),
        value: string(),
      }),
      object({
        type: literal('b'),
        value: integer(),
      }),
    ])

    it('rejects empty object', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects object with null discriminator', () => {
      const result = schema.safeParse({
        type: null,
        value: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('rejects object with undefined discriminator', () => {
      const result = schema.safeParse({
        type: undefined,
        value: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('rejects primitive values', () => {
      expect(schema.safeParse(42).success).toBe(false)
      expect(schema.safeParse('string').success).toBe(false)
      expect(schema.safeParse(true).success).toBe(false)
    })

    it('handles empty string discriminator', () => {
      const emptySchema = discriminatedUnion('key', [
        object({
          key: literal(''),
          value: string(),
        }),
      ])

      const result = emptySchema.safeParse({
        key: '',
        value: 'test',
      })
      expect(result.success).toBe(true)
    })

    it('handles zero discriminator', () => {
      const zeroSchema = discriminatedUnion('count', [
        object({
          count: literal(0),
          value: string(),
        }),
      ])

      const result = zeroSchema.safeParse({
        count: 0,
        value: 'test',
      })
      expect(result.success).toBe(true)
    })

    it('handles false discriminator', () => {
      const falseSchema = discriminatedUnion('flag', [
        object({
          flag: literal(false),
          value: string(),
        }),
      ])

      const result = falseSchema.safeParse({
        flag: false,
        value: 'test',
      })
      expect(result.success).toBe(true)
    })

    it('rejects class instances', () => {
      class CustomClass {
        type = 'a'
        value = 'test'
      }
      const result = schema.safeParse(new CustomClass())
      expect(result.success).toBe(false)
    })

    it('handles discriminator with special characters', () => {
      const specialSchema = discriminatedUnion('$type', [
        object({
          $type: literal('test'),
          value: string(),
        }),
      ])

      const result = specialSchema.safeParse({
        $type: 'test',
        value: 'data',
      })
      expect(result.success).toBe(true)
    })

    it('handles objects with prototype properties', () => {
      const obj = Object.create({ type: 'a' })
      obj.value = 'test'
      // Should fail because discriminator is not an own property
      const result = schema.safeParse(obj)
      expect(result.success).toBe(false)
    })

    it('validates object with discriminator as own property', () => {
      const obj = Object.create(null)
      obj.type = 'a'
      obj.value = 'test'
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
    })
  })

  describe('complex nested structures', () => {
    const schema = discriminatedUnion('type', [
      object({
        type: literal('user'),
        name: string(),
        age: integer(),
      }),
      object({
        type: literal('post'),
        title: string(),
        content: string(),
      }),
    ])

    it('validates complex user object', () => {
      const result = schema.safeParse({
        type: 'user',
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('validates complex post object', () => {
      const result = schema.safeParse({
        type: 'post',
        title: 'Hello World',
        content: 'This is a test post',
      })
      expect(result.success).toBe(true)
    })

    it('rejects user with missing age', () => {
      const result = schema.safeParse({
        type: 'user',
        name: 'Alice',
      })
      expect(result.success).toBe(false)
    })

    it('rejects post with invalid content type', () => {
      const result = schema.safeParse({
        type: 'post',
        title: 'Hello World',
        content: 123,
      })
      expect(result.success).toBe(false)
    })

    it('rejects mixed properties from different variants', () => {
      const result = schema.safeParse({
        type: 'user',
        name: 'Alice',
        title: 'Hello World',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('discriminator key variations', () => {
    it('works with different discriminator key names', () => {
      const kindSchema = discriminatedUnion('kind', [
        object({
          kind: literal('a'),
          value: string(),
        }),
      ])

      const tagSchema = discriminatedUnion('tag', [
        object({
          tag: literal('a'),
          value: string(),
        }),
      ])

      expect(kindSchema.safeParse({ kind: 'a', value: 'test' }).success).toBe(
        true,
      )
      expect(tagSchema.safeParse({ tag: 'a', value: 'test' }).success).toBe(
        true,
      )
    })

    it('rejects when discriminator key does not match schema', () => {
      const schema = discriminatedUnion('type', [
        object({
          type: literal('a'),
          value: string(),
        }),
      ])

      const result = schema.safeParse({
        kind: 'a',
        value: 'test',
      })
      expect(result.success).toBe(false)
    })
  })
})
