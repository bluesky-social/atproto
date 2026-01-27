import { describe, expect, it } from 'vitest'
import { integer } from './integer.js'
import { object } from './object.js'
import { payload } from './payload.js'
import { string } from './string.js'
import { unknown } from './unknown.js'

describe('Payload', () => {
  describe('basic construction', () => {
    it('creates payload with encoding and no schema', () => {
      const def = payload('application/json', undefined)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload with encoding and schema', () => {
      const schema = object({
        name: string(),
      })
      const def = payload('application/json', schema)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBe(schema)
    })

    it('creates payload with undefined encoding and undefined schema', () => {
      const def = payload(undefined, undefined)
      expect(def.encoding).toBeUndefined()
      expect(def.schema).toBeUndefined()
    })

    it('creates payload with text encoding', () => {
      const def = payload('text/plain', undefined)
      expect(def.encoding).toBe('text/plain')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload with text/html encoding', () => {
      const def = payload('text/html', undefined)
      expect(def.encoding).toBe('text/html')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload with application/octet-stream encoding', () => {
      const def = payload('application/octet-stream', undefined)
      expect(def.encoding).toBe('application/octet-stream')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload with image encoding', () => {
      const def = payload('image/png', undefined)
      expect(def.encoding).toBe('image/png')
      expect(def.schema).toBeUndefined()
    })
  })

  describe('encoding types', () => {
    it('handles application/json encoding', () => {
      const def = payload('application/json', undefined)
      expect(def.encoding).toBe('application/json')
    })

    it('handles text/* encodings', () => {
      const textPlain = payload('text/plain', undefined)
      expect(textPlain.encoding).toBe('text/plain')

      const textHtml = payload('text/html', undefined)
      expect(textHtml.encoding).toBe('text/html')

      const textCss = payload('text/css', undefined)
      expect(textCss.encoding).toBe('text/css')
    })

    it('handles binary encodings', () => {
      const octetStream = payload('application/octet-stream', undefined)
      expect(octetStream.encoding).toBe('application/octet-stream')

      const imagePng = payload('image/png', undefined)
      expect(imagePng.encoding).toBe('image/png')

      const imageJpeg = payload('image/jpeg', undefined)
      expect(imageJpeg.encoding).toBe('image/jpeg')
    })

    it('handles custom mime types', () => {
      const def = payload('application/vnd.custom+json', undefined)
      expect(def.encoding).toBe('application/vnd.custom+json')
    })
  })

  describe('with schemas', () => {
    it('creates payload with object schema', () => {
      const schema = object({
        id: integer(),
        name: string(),
      })
      const def = payload('application/json', schema)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBe(schema)
    })

    it('creates payload with string schema', () => {
      const schema = string()
      const def = payload('application/json', schema)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBe(schema)
    })

    it('creates payload with integer schema', () => {
      const schema = integer()
      const def = payload('application/json', schema)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBe(schema)
    })

    it('creates payload with unknown schema', () => {
      const schema = unknown()
      const def = payload('application/json', schema)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBe(schema)
    })

    it('creates payload with complex nested schema', () => {
      const schema = object({
        user: object({
          id: integer(),
          name: string(),
          email: string({ format: 'uri' }),
        }),
        metadata: object({
          createdAt: string({ format: 'datetime' }),
          updatedAt: string({ format: 'datetime' }),
        }),
      })
      const def = payload('application/json', schema)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBe(schema)
    })
  })

  describe('validation constraints', () => {
    it('throws error when schema is defined but encoding is undefined', () => {
      const schema = string()
      expect(() => {
        // @ts-expect-error
        payload(undefined, schema)
      }).toThrow(TypeError)
      expect(() => {
        // @ts-expect-error
        payload(undefined, schema)
      }).toThrow('schema cannot be defined when encoding is undefined')
    })

    it('throws error when object schema is defined but encoding is undefined', () => {
      const schema = object({
        name: string(),
      })
      expect(() => {
        // @ts-expect-error
        payload(undefined, schema)
      }).toThrow(TypeError)
      expect(() => {
        // @ts-expect-error
        payload(undefined, schema)
      }).toThrow('schema cannot be defined when encoding is undefined')
    })

    it('throws error when integer schema is defined but encoding is undefined', () => {
      const schema = integer()
      expect(() => {
        // @ts-expect-error
        payload(undefined, schema)
      }).toThrow(TypeError)
    })

    it('allows undefined encoding with undefined schema', () => {
      expect(() => {
        payload(undefined, undefined)
      }).not.toThrow()
    })

    it('allows defined encoding with undefined schema', () => {
      expect(() => {
        payload('application/json', undefined)
      }).not.toThrow()
    })

    it('allows defined encoding with defined schema', () => {
      const schema = string()
      expect(() => {
        payload('application/json', schema)
      }).not.toThrow()
    })
  })

  describe('property access', () => {
    it('has accessible encoding property', () => {
      const def = payload('application/json', undefined)
      expect(def.encoding).toBe('application/json')
    })

    it('has accessible schema property', () => {
      const schema = string()
      const def = payload('application/json', schema)
      expect(def.schema).toBe(schema)
    })

    it('encoding property is immutable in TypeScript', () => {
      const def = payload('application/json', undefined)
      // TypeScript enforces readonly at compile time
      expect(def.encoding).toBe('application/json')
    })

    it('schema property is immutable in TypeScript', () => {
      const schema = string()
      const def = payload('application/json', schema)
      // TypeScript enforces readonly at compile time
      expect(def.schema).toBe(schema)
    })
  })

  describe('usage scenarios', () => {
    it('creates payload for JSON API response', () => {
      const def = payload(
        'application/json',
        object({
          success: string(),
          data: unknown(),
        }),
      )
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBeDefined()
    })

    it('creates payload for plain text response', () => {
      const def = payload('text/plain', undefined)
      expect(def.encoding).toBe('text/plain')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload for binary data', () => {
      const def = payload('application/octet-stream', undefined)
      expect(def.encoding).toBe('application/octet-stream')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload for image upload', () => {
      const def = payload('image/jpeg', undefined)
      expect(def.encoding).toBe('image/jpeg')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload for multipart form data', () => {
      const def = payload('multipart/form-data', undefined)
      expect(def.encoding).toBe('multipart/form-data')
      expect(def.schema).toBeUndefined()
    })

    it('creates payload for URL encoded form', () => {
      const def = payload('application/x-www-form-urlencoded', undefined)
      expect(def.encoding).toBe('application/x-www-form-urlencoded')
      expect(def.schema).toBeUndefined()
    })

    it('creates empty payload (no encoding, no schema)', () => {
      const def = payload(undefined, undefined)
      expect(def.encoding).toBeUndefined()
      expect(def.schema).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('handles encoding with charset parameter', () => {
      const def = payload('application/json; charset=utf-8', undefined)
      expect(def.encoding).toBe('application/json; charset=utf-8')
    })

    it('handles encoding with multiple parameters', () => {
      const def = payload('multipart/form-data; boundary=something', undefined)
      expect(def.encoding).toBe('multipart/form-data; boundary=something')
    })

    it('handles empty string encoding', () => {
      const def = payload('', undefined)
      expect(def.encoding).toBe('')
    })

    it('creates multiple payloads with same schema reference', () => {
      const sharedSchema = object({
        id: integer(),
      })
      const def1 = payload('application/json', sharedSchema)
      const def2 = payload('application/json', sharedSchema)

      expect(def1.schema).toBe(def2.schema)
      expect(def1.schema).toBe(sharedSchema)
    })

    it('creates multiple payloads with different schemas', () => {
      const schema1 = string()
      const schema2 = integer()
      const def1 = payload('application/json', schema1)
      const def2 = payload('application/json', schema2)

      expect(def1.schema).not.toBe(def2.schema)
      expect(def1.schema).toBe(schema1)
      expect(def2.schema).toBe(schema2)
    })
  })

  describe('type inference scenarios', () => {
    it('works with application/json and object schema', () => {
      const schema = object({
        message: string(),
      })
      const def = payload('application/json', schema)
      expect(def.encoding).toBe('application/json')
      expect(def.schema).toBe(schema)
    })

    it('works with text/* encodings expecting string bodies', () => {
      const def1 = payload('text/plain', undefined)
      const def2 = payload('text/html', undefined)
      const def3 = payload('text/csv', undefined)

      expect(def1.encoding).toBe('text/plain')
      expect(def2.encoding).toBe('text/html')
      expect(def3.encoding).toBe('text/csv')
    })

    it('works with binary encodings expecting Uint8Array bodies', () => {
      const def1 = payload('image/png', undefined)
      const def2 = payload('application/octet-stream', undefined)
      const def3 = payload('video/mp4', undefined)

      expect(def1.encoding).toBe('image/png')
      expect(def2.encoding).toBe('application/octet-stream')
      expect(def3.encoding).toBe('video/mp4')
    })
  })
})
