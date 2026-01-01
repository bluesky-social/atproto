import { describe, expect, it } from 'vitest'
import { ObjectSchema } from './object.js'
import { RecordSchema } from './record.js'
import { StringSchema } from './string.js'

describe('RecordSchema', () => {
  describe('basic validation', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('validates record with correct $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('app.bsky.feed.post')
        expect(result.value.text).toBe('Hello world')
      }
    })

    it('rejects record with incorrect $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.like',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects record missing $type', () => {
      const result = schema.safeParse({
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
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
      const result = schema.safeParse([{ $type: 'app.bsky.feed.post' }])
      expect(result.success).toBe(false)
    })
  })

  describe('isTypeOf method', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('returns true for matching $type', () => {
      const result = schema.isTypeOf({ $type: 'app.bsky.feed.post' })
      expect(result).toBe(true)
    })

    it('returns false for non-matching $type', () => {
      const result = schema.isTypeOf({ $type: 'app.bsky.feed.like' })
      expect(result).toBe(false)
    })

    it('returns false for missing $type', () => {
      const result = schema.isTypeOf({})
      expect(result).toBe(false)
    })

    it('returns false for undefined $type', () => {
      const result = schema.isTypeOf({ $type: undefined })
      expect(result).toBe(false)
    })

    it('returns false for null $type', () => {
      const result = schema.isTypeOf({ $type: null })
      expect(result).toBe(false)
    })
  })

  describe('build method', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('adds correct $type to input', () => {
      const result = schema.build({ text: 'Hello world' })
      expect(result.$type).toBe('app.bsky.feed.post')
      expect(result.text).toBe('Hello world')
    })

    it('preserves existing properties', () => {
      const result = schema.build({
        text: 'Hello world',
        extra: 'value',
      })
      expect(result.$type).toBe('app.bsky.feed.post')
      expect(result.text).toBe('Hello world')
      expect(result.extra).toBe('value')
    })

    it('overwrites existing $type', () => {
      const result = schema.build({
        $type: 'wrong.type',
        text: 'Hello world',
      })
      expect(result.$type).toBe('app.bsky.feed.post')
    })
  })

  describe('key type: any', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('validates record keys', () => {
      const result = schema.keySchema.safeParse('anyStringKey')
      expect(result.success).toBe(true)
    })

    it('validates alphanumeric keys', () => {
      const result = schema.keySchema.safeParse('key123')
      expect(result.success).toBe(true)
    })

    it('validates keys with special characters', () => {
      const result = schema.keySchema.safeParse('key-with-dashes')
      expect(result.success).toBe(true)
    })

    it('rejects empty strings', () => {
      const result = schema.keySchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('rejects non-strings', () => {
      const result = schema.keySchema.safeParse(123)
      expect(result.success).toBe(false)
    })
  })

  describe('key type: tid', () => {
    const schema = new RecordSchema(
      'tid',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('validates valid TID', () => {
      const result = schema.keySchema.safeParse('3jzfcijpj2z2a')
      expect(result.success).toBe(true)
    })

    it('rejects invalid TID format', () => {
      const result = schema.keySchema.safeParse('not-a-tid')
      expect(result.success).toBe(false)
    })

    it('rejects TID with invalid characters', () => {
      const result = schema.keySchema.safeParse('3jzfcijpj2z2!')
      expect(result.success).toBe(false)
    })

    it('rejects empty strings', () => {
      const result = schema.keySchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('rejects regular strings', () => {
      const result = schema.keySchema.safeParse('regularString')
      expect(result.success).toBe(false)
    })
  })

  describe('key type: nsid', () => {
    const schema = new RecordSchema(
      'nsid',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('validates valid NSID', () => {
      const result = schema.keySchema.safeParse('app.bsky.feed.post')
      expect(result.success).toBe(true)
    })

    it('validates NSID with multiple segments', () => {
      const result = schema.keySchema.safeParse(
        'com.example.app.feature.action',
      )
      expect(result.success).toBe(true)
    })

    it('rejects invalid NSID format', () => {
      const result = schema.keySchema.safeParse('not-an-nsid')
      expect(result.success).toBe(false)
    })

    it('rejects NSID with invalid characters', () => {
      const result = schema.keySchema.safeParse('app.bsky.feed!')
      expect(result.success).toBe(false)
    })

    it('rejects empty strings', () => {
      const result = schema.keySchema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('key type: literal', () => {
    describe('literal:self', () => {
      const schema = new RecordSchema(
        'literal:self',
        'app.bsky.feed.post',
        new ObjectSchema({
          $type: new StringSchema({}),
          text: new StringSchema({}),
        }),
      )

      it('validates exact literal "self"', () => {
        const result = schema.keySchema.safeParse('self')
        expect(result.success).toBe(true)
      })

      it('rejects non-matching strings', () => {
        const result = schema.keySchema.safeParse('other')
        expect(result.success).toBe(false)
      })

      it('rejects case variations', () => {
        const result = schema.keySchema.safeParse('Self')
        expect(result.success).toBe(false)
      })

      it('rejects empty strings', () => {
        const result = schema.keySchema.safeParse('')
        expect(result.success).toBe(false)
      })
    })

    describe('literal:customKey', () => {
      const schema = new RecordSchema(
        'literal:customKey',
        'app.bsky.feed.post',
        new ObjectSchema({
          $type: new StringSchema({}),
          text: new StringSchema({}),
        }),
      )

      it('validates exact literal match', () => {
        const result = schema.keySchema.safeParse('customKey')
        expect(result.success).toBe(true)
      })

      it('rejects non-matching strings', () => {
        const result = schema.keySchema.safeParse('otherKey')
        expect(result.success).toBe(false)
      })

      it('rejects partial matches', () => {
        const result = schema.keySchema.safeParse('custom')
        expect(result.success).toBe(false)
      })
    })
  })

  describe('$type with hash fragment', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post#main',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('validates record with correct $type including hash', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post#main',
        text: 'Hello world',
      })
      expect(result.success).toBe(true)
    })

    it('rejects record with $type without hash', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects record with different hash fragment', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post#other',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('complex nested schema', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({ maxLength: 300 }),
        createdAt: new StringSchema({ format: 'datetime' }),
      }),
    )

    it('validates complex record with all constraints', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
        createdAt: '2023-12-25T12:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('rejects when nested field violates constraints', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'a'.repeat(301),
        createdAt: '2023-12-25T12:00:00Z',
      })
      expect(result.success).toBe(false)
    })

    it('rejects when datetime format is invalid', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
        createdAt: 'not-a-date',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('handles $type as number', () => {
      const result = schema.safeParse({
        $type: 123,
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('handles $type as boolean', () => {
      const result = schema.safeParse({
        $type: true,
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('handles $type as object', () => {
      const result = schema.safeParse({
        $type: { value: 'app.bsky.feed.post' },
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('handles $type as array', () => {
      const result = schema.safeParse({
        $type: ['app.bsky.feed.post'],
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('preserves extra properties not in schema', () => {
      const input = {
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
        extra: 'value',
        another: 123,
      }

      const result = schema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        // @ts-expect-error
        expect(result.value.extra).toBe('value')
        // @ts-expect-error
        expect(result.value.another).toBe(123)
      }
    })

    it('handles empty object', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('handles deeply nested structures', () => {
      const complexSchema = new RecordSchema(
        'any',
        'app.bsky.complex',
        new ObjectSchema({
          $type: new StringSchema({}),
          nested: new ObjectSchema({
            deep: new ObjectSchema({
              value: new StringSchema({}),
            }),
          }),
        }),
      )

      const result = complexSchema.safeParse({
        $type: 'app.bsky.complex',
        nested: {
          deep: {
            value: 'test',
          },
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('$isTypeOf method', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('returns true for matching $type', () => {
      const result = schema.$isTypeOf({ $type: 'app.bsky.feed.post' })
      expect(result).toBe(true)
    })

    it('returns false for non-matching $type', () => {
      const result = schema.$isTypeOf({ $type: 'app.bsky.feed.like' })
      expect(result).toBe(false)
    })
  })

  describe('$build method', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('adds correct $type to input', () => {
      const result = schema.$build({ text: 'Hello world' })
      expect(result.$type).toBe('app.bsky.feed.post')
      expect(result.text).toBe('Hello world')
    })
  })

  describe('validation with missing required fields', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
        author: new StringSchema({}),
      }),
    )

    it('rejects when required field is missing', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('validates when all required fields are present', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
        author: 'did:plc:123',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('different record key types', () => {
    it('constructs with key type "any"', () => {
      const schema = new RecordSchema(
        'any',
        'app.bsky.test',
        new ObjectSchema({ $type: new StringSchema({}) }),
      )
      expect(schema.key).toBe('any')
      expect(schema.keySchema).toBeDefined()
    })

    it('constructs with key type "tid"', () => {
      const schema = new RecordSchema(
        'tid',
        'app.bsky.test',
        new ObjectSchema({ $type: new StringSchema({}) }),
      )
      expect(schema.key).toBe('tid')
      expect(schema.keySchema).toBeDefined()
    })

    it('constructs with key type "nsid"', () => {
      const schema = new RecordSchema(
        'nsid',
        'app.bsky.test',
        new ObjectSchema({ $type: new StringSchema({}) }),
      )
      expect(schema.key).toBe('nsid')
      expect(schema.keySchema).toBeDefined()
    })

    it('constructs with literal key type', () => {
      const schema = new RecordSchema(
        'literal:custom',
        'app.bsky.test',
        new ObjectSchema({ $type: new StringSchema({}) }),
      )
      expect(schema.key).toBe('literal:custom')
      expect(schema.keySchema).toBeDefined()
    })
  })

  describe('validation with undefined vs missing fields', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('rejects when required field is explicitly undefined', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: undefined,
      })
      expect(result.success).toBe(false)
    })

    it('rejects when $type is explicitly undefined', () => {
      const result = schema.safeParse({
        $type: undefined,
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects when $type is null', () => {
      const result = schema.safeParse({
        $type: null,
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('record with empty $type string', () => {
    it('rejects empty $type string', () => {
      const schema = new RecordSchema(
        'any',
        'app.bsky.feed.post',
        new ObjectSchema({
          $type: new StringSchema({}),
          text: new StringSchema({}),
        }),
      )

      const result = schema.safeParse({
        $type: '',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('special characters in $type', () => {
    it('validates $type with dots', () => {
      const schema = new RecordSchema(
        'any',
        'app.bsky.feed.post',
        new ObjectSchema({
          $type: new StringSchema({}),
          text: new StringSchema({}),
        }),
      )

      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
      })
      expect(result.success).toBe(true)
    })

    it('validates $type with hash and alphanumeric fragment', () => {
      const schema = new RecordSchema(
        'any',
        'app.bsky.feed.post#reply123',
        new ObjectSchema({
          $type: new StringSchema({}),
          text: new StringSchema({}),
        }),
      )

      const result = schema.safeParse({
        $type: 'app.bsky.feed.post#reply123',
        text: 'Hello world',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('case sensitivity', () => {
    const schema = new RecordSchema(
      'any',
      'app.bsky.feed.post',
      new ObjectSchema({
        $type: new StringSchema({}),
        text: new StringSchema({}),
      }),
    )

    it('rejects $type with different case', () => {
      const result = schema.safeParse({
        $type: 'App.Bsky.Feed.Post',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects $type with uppercase', () => {
      const result = schema.safeParse({
        $type: 'APP.BSKY.FEED.POST',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })
  })
})
