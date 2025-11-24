import { BooleanSchema } from './boolean.js'
import { DictSchema } from './dict.js'
import { EnumSchema } from './enum.js'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { StringSchema } from './string.js'

describe('ObjectSchema', () => {
  describe('simple schema', () => {
    const schema = new ObjectSchema(
      {
        name: new StringSchema({}),
        age: new IntegerSchema({}),
        gender: new EnumSchema(['male', 'female']),
      },
      {
        required: ['name'],
        nullable: ['gender'],
      },
    )

    it('validates plain objects', () => {
      const result = schema.validate({
        name: 'Alice',
        age: 30,
        gender: 'female',
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-objects', () => {
      const result = schema.validate('not an object')
      expect(result.success).toBe(false)
    })

    it('rejects missing properties', () => {
      const result = schema.validate({
        age: 30,
        gender: 'female',
      })
      expect(result.success).toBe(false)
    })

    it('validates optional properties', () => {
      const result = schema.validate({
        name: 'Alice',
      })
      expect(result.success).toBe(true)
    })

    it('validates nullable properties', () => {
      const result = schema.validate({
        name: 'Alice',
        gender: null,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid property types', () => {
      const result = schema.validate({
        name: 'Alice',
        age: 'thirty',
      })
      expect(result.success).toBe(false)
    })

    it('ignores extra properties', () => {
      const result = schema.validate({
        name: 'Alice',
        age: 30,
        extra: 'value',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('strict schema', () => {
    const schema = new ObjectSchema(
      {
        id: new StringSchema({}),
        score: new IntegerSchema({}),
      },
      {
        required: ['id', 'score'],
        unknownProperties: 'strict',
      },
    )

    it('rejects extra properties in strict mode', () => {
      const result = schema.validate({
        id: 'item1',
        score: 100,
        extra: 'not allowed',
      })
      expect(result.success).toBe(false)
    })

    it('accepts only defined properties in strict mode', () => {
      const result = schema.validate({
        id: 'item1',
        score: 100,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('schema with unknownProperties validator', () => {
    const schema = new ObjectSchema(
      {
        title: new StringSchema({}),
      },
      {
        required: ['title'],
        unknownProperties: new DictSchema(
          new EnumSchema(['tag1', 'tag2']),
          new BooleanSchema({}),
        ),
      },
    )

    it('validates extra properties with the provided validator', () => {
      const result = schema.validate({
        title: 'My Post',
        tag1: true,
        tag2: false,
      })
      expect(result.success).toBe(true)
    })

    it('rejects extra properties that fail the provided validator', () => {
      const result = schema.validate({
        title: 'My Post',
        tag1: 'not a boolean',
      })
      expect(result.success).toBe(false)
    })
  })
})
