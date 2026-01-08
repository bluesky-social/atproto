import { describe, expect, it } from 'vitest'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { Payload } from './payload.js'
import { StringSchema } from './string.js'
import { UnknownSchema } from './unknown.js'

describe('Payload', () => {
  describe('basic construction', () => {
    it('creates payload with encoding and no schema', () => {
      const payload = new Payload('application/json', undefined)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload with encoding and schema', () => {
      const schema = new ObjectSchema({
        name: new StringSchema({}),
      })
      const payload = new Payload('application/json', schema)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBe(schema)
    })

    it('creates payload with undefined encoding and undefined schema', () => {
      const payload = new Payload(undefined, undefined)
      expect(payload.encoding).toBeUndefined()
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload with text encoding', () => {
      const payload = new Payload('text/plain', undefined)
      expect(payload.encoding).toBe('text/plain')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload with text/html encoding', () => {
      const payload = new Payload('text/html', undefined)
      expect(payload.encoding).toBe('text/html')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload with application/octet-stream encoding', () => {
      const payload = new Payload('application/octet-stream', undefined)
      expect(payload.encoding).toBe('application/octet-stream')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload with image encoding', () => {
      const payload = new Payload('image/png', undefined)
      expect(payload.encoding).toBe('image/png')
      expect(payload.schema).toBeUndefined()
    })
  })

  describe('encoding types', () => {
    it('handles application/json encoding', () => {
      const payload = new Payload('application/json', undefined)
      expect(payload.encoding).toBe('application/json')
    })

    it('handles text/* encodings', () => {
      const textPlain = new Payload('text/plain', undefined)
      expect(textPlain.encoding).toBe('text/plain')

      const textHtml = new Payload('text/html', undefined)
      expect(textHtml.encoding).toBe('text/html')

      const textCss = new Payload('text/css', undefined)
      expect(textCss.encoding).toBe('text/css')
    })

    it('handles binary encodings', () => {
      const octetStream = new Payload('application/octet-stream', undefined)
      expect(octetStream.encoding).toBe('application/octet-stream')

      const imagePng = new Payload('image/png', undefined)
      expect(imagePng.encoding).toBe('image/png')

      const imageJpeg = new Payload('image/jpeg', undefined)
      expect(imageJpeg.encoding).toBe('image/jpeg')
    })

    it('handles custom mime types', () => {
      const payload = new Payload('application/vnd.custom+json', undefined)
      expect(payload.encoding).toBe('application/vnd.custom+json')
    })
  })

  describe('with schemas', () => {
    it('creates payload with object schema', () => {
      const schema = new ObjectSchema({
        id: new IntegerSchema({}),
        name: new StringSchema({}),
      })
      const payload = new Payload('application/json', schema)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBe(schema)
    })

    it('creates payload with string schema', () => {
      const schema = new StringSchema({})
      const payload = new Payload('application/json', schema)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBe(schema)
    })

    it('creates payload with integer schema', () => {
      const schema = new IntegerSchema({})
      const payload = new Payload('application/json', schema)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBe(schema)
    })

    it('creates payload with unknown schema', () => {
      const schema = new UnknownSchema()
      const payload = new Payload('application/json', schema)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBe(schema)
    })

    it('creates payload with complex nested schema', () => {
      const schema = new ObjectSchema({
        user: new ObjectSchema({
          id: new IntegerSchema({}),
          name: new StringSchema({}),
          email: new StringSchema({ format: 'uri' }),
        }),
        metadata: new ObjectSchema({
          createdAt: new StringSchema({ format: 'datetime' }),
          updatedAt: new StringSchema({ format: 'datetime' }),
        }),
      })
      const payload = new Payload('application/json', schema)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBe(schema)
    })
  })

  describe('validation constraints', () => {
    it('throws error when schema is defined but encoding is undefined', () => {
      const schema = new StringSchema({})
      expect(() => {
        // @ts-expect-error
        new Payload(undefined, schema)
      }).toThrow(TypeError)
      expect(() => {
        // @ts-expect-error
        new Payload(undefined, schema)
      }).toThrow('schema cannot be defined when encoding is undefined')
    })

    it('throws error when object schema is defined but encoding is undefined', () => {
      const schema = new ObjectSchema({
        name: new StringSchema({}),
      })
      expect(() => {
        // @ts-expect-error
        new Payload(undefined, schema)
      }).toThrow(TypeError)
      expect(() => {
        // @ts-expect-error
        new Payload(undefined, schema)
      }).toThrow('schema cannot be defined when encoding is undefined')
    })

    it('throws error when integer schema is defined but encoding is undefined', () => {
      const schema = new IntegerSchema({})
      expect(() => {
        // @ts-expect-error
        new Payload(undefined, schema)
      }).toThrow(TypeError)
    })

    it('allows undefined encoding with undefined schema', () => {
      expect(() => {
        new Payload(undefined, undefined)
      }).not.toThrow()
    })

    it('allows defined encoding with undefined schema', () => {
      expect(() => {
        new Payload('application/json', undefined)
      }).not.toThrow()
    })

    it('allows defined encoding with defined schema', () => {
      const schema = new StringSchema({})
      expect(() => {
        new Payload('application/json', schema)
      }).not.toThrow()
    })
  })

  describe('property access', () => {
    it('has accessible encoding property', () => {
      const payload = new Payload('application/json', undefined)
      expect(payload.encoding).toBe('application/json')
    })

    it('has accessible schema property', () => {
      const schema = new StringSchema({})
      const payload = new Payload('application/json', schema)
      expect(payload.schema).toBe(schema)
    })

    it('encoding property is immutable in TypeScript', () => {
      const payload = new Payload('application/json', undefined)
      // TypeScript enforces readonly at compile time
      expect(payload.encoding).toBe('application/json')
    })

    it('schema property is immutable in TypeScript', () => {
      const schema = new StringSchema({})
      const payload = new Payload('application/json', schema)
      // TypeScript enforces readonly at compile time
      expect(payload.schema).toBe(schema)
    })
  })

  describe('usage scenarios', () => {
    it('creates payload for JSON API response', () => {
      const payload = new Payload(
        'application/json',
        new ObjectSchema({
          success: new StringSchema({}),
          data: new UnknownSchema(),
        }),
      )
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBeDefined()
    })

    it('creates payload for plain text response', () => {
      const payload = new Payload('text/plain', undefined)
      expect(payload.encoding).toBe('text/plain')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload for binary data', () => {
      const payload = new Payload('application/octet-stream', undefined)
      expect(payload.encoding).toBe('application/octet-stream')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload for image upload', () => {
      const payload = new Payload('image/jpeg', undefined)
      expect(payload.encoding).toBe('image/jpeg')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload for multipart form data', () => {
      const payload = new Payload('multipart/form-data', undefined)
      expect(payload.encoding).toBe('multipart/form-data')
      expect(payload.schema).toBeUndefined()
    })

    it('creates payload for URL encoded form', () => {
      const payload = new Payload(
        'application/x-www-form-urlencoded',
        undefined,
      )
      expect(payload.encoding).toBe('application/x-www-form-urlencoded')
      expect(payload.schema).toBeUndefined()
    })

    it('creates empty payload (no encoding, no schema)', () => {
      const payload = new Payload(undefined, undefined)
      expect(payload.encoding).toBeUndefined()
      expect(payload.schema).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('handles encoding with charset parameter', () => {
      const payload = new Payload('application/json; charset=utf-8', undefined)
      expect(payload.encoding).toBe('application/json; charset=utf-8')
    })

    it('handles encoding with multiple parameters', () => {
      const payload = new Payload(
        'multipart/form-data; boundary=something',
        undefined,
      )
      expect(payload.encoding).toBe('multipart/form-data; boundary=something')
    })

    it('handles empty string encoding', () => {
      const payload = new Payload('', undefined)
      expect(payload.encoding).toBe('')
    })

    it('creates multiple payloads with same schema reference', () => {
      const sharedSchema = new ObjectSchema({
        id: new IntegerSchema({}),
      })
      const payload1 = new Payload('application/json', sharedSchema)
      const payload2 = new Payload('application/json', sharedSchema)

      expect(payload1.schema).toBe(payload2.schema)
      expect(payload1.schema).toBe(sharedSchema)
    })

    it('creates multiple payloads with different schemas', () => {
      const schema1 = new StringSchema({})
      const schema2 = new IntegerSchema({})
      const payload1 = new Payload('application/json', schema1)
      const payload2 = new Payload('application/json', schema2)

      expect(payload1.schema).not.toBe(payload2.schema)
      expect(payload1.schema).toBe(schema1)
      expect(payload2.schema).toBe(schema2)
    })
  })

  describe('type inference scenarios', () => {
    it('works with application/json and object schema', () => {
      const schema = new ObjectSchema({
        message: new StringSchema({}),
      })
      const payload = new Payload('application/json', schema)
      expect(payload.encoding).toBe('application/json')
      expect(payload.schema).toBe(schema)
    })

    it('works with text/* encodings expecting string bodies', () => {
      const payload1 = new Payload('text/plain', undefined)
      const payload2 = new Payload('text/html', undefined)
      const payload3 = new Payload('text/csv', undefined)

      expect(payload1.encoding).toBe('text/plain')
      expect(payload2.encoding).toBe('text/html')
      expect(payload3.encoding).toBe('text/csv')
    })

    it('works with binary encodings expecting Uint8Array bodies', () => {
      const payload1 = new Payload('image/png', undefined)
      const payload2 = new Payload('application/octet-stream', undefined)
      const payload3 = new Payload('video/mp4', undefined)

      expect(payload1.encoding).toBe('image/png')
      expect(payload2.encoding).toBe('application/octet-stream')
      expect(payload3.encoding).toBe('video/mp4')
    })
  })
})
