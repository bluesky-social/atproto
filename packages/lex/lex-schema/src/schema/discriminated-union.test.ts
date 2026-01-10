import { describe, expect, it } from 'vitest'
import { DiscriminatedUnionSchema } from './discriminated-union.js'
import { EnumSchema } from './enum.js'
import { IntegerSchema } from './integer.js'
import { LiteralSchema } from './literal.js'
import { ObjectSchema } from './object.js'
import { StringSchema } from './string.js'

describe('DiscriminatedUnionSchema', () => {
  describe('with literal discriminators', () => {
    const schema = new DiscriminatedUnionSchema('type', [
      new ObjectSchema({
        type: new LiteralSchema('cat'),
        meow: new StringSchema({}),
      }),
      new ObjectSchema({
        type: new LiteralSchema('dog'),
        bark: new StringSchema({}),
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
    const schema = new DiscriminatedUnionSchema('status', [
      new ObjectSchema({
        status: new EnumSchema(['pending', 'processing']),
        progress: new IntegerSchema({}),
      }),
      new ObjectSchema({
        status: new EnumSchema(['complete', 'failed']),
        result: new StringSchema({}),
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
    const schema = new DiscriminatedUnionSchema('kind', [
      new ObjectSchema({
        kind: new LiteralSchema('simple'),
        value: new StringSchema({}),
      }),
      new ObjectSchema({
        kind: new EnumSchema(['complex', 'advanced']),
        value: new IntegerSchema({}),
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
    const schema = new DiscriminatedUnionSchema('type', [
      new ObjectSchema({
        type: new LiteralSchema('only'),
        value: new StringSchema({}),
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
    const schema = new DiscriminatedUnionSchema('shape', [
      new ObjectSchema({
        shape: new LiteralSchema('circle'),
        radius: new IntegerSchema({}),
      }),
      new ObjectSchema({
        shape: new LiteralSchema('square'),
        side: new IntegerSchema({}),
      }),
      new ObjectSchema({
        shape: new LiteralSchema('rectangle'),
        width: new IntegerSchema({}),
        height: new IntegerSchema({}),
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
    const schema = new DiscriminatedUnionSchema('version', [
      new ObjectSchema({
        version: new LiteralSchema(1),
        oldFormat: new StringSchema({}),
      }),
      new ObjectSchema({
        version: new LiteralSchema(2),
        newFormat: new StringSchema({}),
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
    const schema = new DiscriminatedUnionSchema('enabled', [
      new ObjectSchema({
        enabled: new LiteralSchema(true),
        config: new StringSchema({}),
      }),
      new ObjectSchema({
        enabled: new LiteralSchema(false),
        reason: new StringSchema({}),
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
    const schema = new DiscriminatedUnionSchema('value', [
      new ObjectSchema({
        value: new LiteralSchema(null),
        empty: new StringSchema({}),
      }),
      new ObjectSchema({
        value: new LiteralSchema('present'),
        data: new StringSchema({}),
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
        new DiscriminatedUnionSchema('type', [
          new ObjectSchema({
            type: new LiteralSchema('duplicate'),
            a: new StringSchema({}),
          }),
          new ObjectSchema({
            type: new LiteralSchema('duplicate'),
            b: new StringSchema({}),
          }),
        ])
      }).toThrow('Overlapping discriminator value: duplicate')
    })

    it('throws on overlapping enum discriminator values', () => {
      expect(() => {
        new DiscriminatedUnionSchema('status', [
          new ObjectSchema({
            status: new EnumSchema(['active', 'pending']),
            a: new StringSchema({}),
          }),
          new ObjectSchema({
            status: new EnumSchema(['pending', 'complete']),
            b: new StringSchema({}),
          }),
        ])
      }).toThrow('Overlapping discriminator value: pending')
    })

    it('throws on overlapping literal and enum discriminator values', () => {
      expect(() => {
        new DiscriminatedUnionSchema('kind', [
          new ObjectSchema({
            kind: new LiteralSchema('test'),
            a: new StringSchema({}),
          }),
          new ObjectSchema({
            kind: new EnumSchema(['test', 'other']),
            b: new StringSchema({}),
          }),
        ])
      }).toThrow('Overlapping discriminator value: test')
    })
  })

  describe('edge cases', () => {
    const schema = new DiscriminatedUnionSchema('type', [
      new ObjectSchema({
        type: new LiteralSchema('a'),
        value: new StringSchema({}),
      }),
      new ObjectSchema({
        type: new LiteralSchema('b'),
        value: new IntegerSchema({}),
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
      const emptySchema = new DiscriminatedUnionSchema('key', [
        new ObjectSchema({
          key: new LiteralSchema(''),
          value: new StringSchema({}),
        }),
      ])

      const result = emptySchema.safeParse({
        key: '',
        value: 'test',
      })
      expect(result.success).toBe(true)
    })

    it('handles zero discriminator', () => {
      const zeroSchema = new DiscriminatedUnionSchema('count', [
        new ObjectSchema({
          count: new LiteralSchema(0),
          value: new StringSchema({}),
        }),
      ])

      const result = zeroSchema.safeParse({
        count: 0,
        value: 'test',
      })
      expect(result.success).toBe(true)
    })

    it('handles false discriminator', () => {
      const falseSchema = new DiscriminatedUnionSchema('flag', [
        new ObjectSchema({
          flag: new LiteralSchema(false),
          value: new StringSchema({}),
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
      const specialSchema = new DiscriminatedUnionSchema('$type', [
        new ObjectSchema({
          $type: new LiteralSchema('test'),
          value: new StringSchema({}),
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
    const schema = new DiscriminatedUnionSchema('type', [
      new ObjectSchema({
        type: new LiteralSchema('user'),
        name: new StringSchema({}),
        age: new IntegerSchema({}),
      }),
      new ObjectSchema({
        type: new LiteralSchema('post'),
        title: new StringSchema({}),
        content: new StringSchema({}),
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
      const kindSchema = new DiscriminatedUnionSchema('kind', [
        new ObjectSchema({
          kind: new LiteralSchema('a'),
          value: new StringSchema({}),
        }),
      ])

      const tagSchema = new DiscriminatedUnionSchema('tag', [
        new ObjectSchema({
          tag: new LiteralSchema('a'),
          value: new StringSchema({}),
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
      const schema = new DiscriminatedUnionSchema('type', [
        new ObjectSchema({
          type: new LiteralSchema('a'),
          value: new StringSchema({}),
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
