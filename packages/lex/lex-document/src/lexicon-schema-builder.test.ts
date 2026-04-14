import { beforeAll, describe, expect, it } from 'vitest'
import { parseCid } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'
import { LexiconDocument, lexiconDocumentSchema } from './lexicon-document.js'
import { LexiconIterableIndexer } from './lexicon-iterable-indexer.js'
import { LexiconSchemaBuilder } from './lexicon-schema-builder.js'

describe('LexiconSchemaBuilder', () => {
  let schemas: Map<
    string,
    | l.Validator<unknown>
    | l.Query
    | l.Subscription
    | l.Procedure
    | l.PermissionSet
  >

  const getSchema = <T extends abstract new (...args: any) => any>(
    ref: string,
    type: T,
  ) => {
    const schema = schemas.get(ref)
    expect(schema).toBeDefined()
    expect(schema).toBeInstanceOf(type)
    return schema as InstanceType<T>
  }

  beforeAll(async () => {
    const indexer = new LexiconIterableIndexer([
      lexiconDocumentSchema.parse({
        lexicon: 1,
        id: 'com.example.kitchenSink',
        defs: {
          main: {
            type: 'record',
            description: 'A record',
            key: 'tid',
            record: {
              type: 'object',
              required: [
                'object',
                'array',
                'boolean',
                'integer',
                'string',
                'bytes',
                'cidLink',
              ],
              properties: {
                object: { type: 'ref', ref: '#object' },
                array: { type: 'array', items: { type: 'string' } },
                boolean: { type: 'boolean' },
                integer: { type: 'integer' },
                string: { type: 'string' },
                bytes: { type: 'bytes' },
                cidLink: { type: 'cid-link' },
              },
            },
          },
          object: {
            type: 'object',
            required: ['object', 'array', 'boolean', 'integer', 'string'],
            properties: {
              object: { type: 'ref', ref: '#subObject' },
              array: { type: 'array', items: { type: 'string' } },
              boolean: { type: 'boolean' },
              integer: { type: 'integer' },
              string: { type: 'string' },
              refToEnumWithDefault: { type: 'ref', ref: '#enumWithDefault' },
            },
          },
          subObject: {
            type: 'object',
            required: ['boolean'],
            properties: {
              boolean: { type: 'boolean' },
            },
          },
          enumWithDefault: {
            type: 'string',
            default: 'option3',
            enum: ['option1', 'option2', 'option3'],
          },
        },
      }),
    ])
    schemas = await LexiconSchemaBuilder.buildAll(indexer)
  })

  it('Validates records correctly', () => {
    const schema = getSchema('com.example.kitchenSink#main', l.RecordSchema)

    const value = {
      $type: 'com.example.kitchenSink',
      object: {
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
        refToEnumWithDefault: 'option3',
      },
      array: ['one', 'two'],
      boolean: true,
      integer: 123,
      string: 'string',
      datetime: new Date().toISOString(),
      atUri: 'at://did:web:example.com/com.example.test/self',
      did: 'did:web:example.com',
      cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      bytes: new Uint8Array([0, 1, 2, 3]),
      cidLink: parseCid(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
    }

    expect(schema.safeParse(value)).toStrictEqual({ success: true, value })
  })

  it('Validates objects correctly', () => {
    const schema = getSchema(
      'com.example.kitchenSink#object',
      l.TypedObjectSchema,
    )

    const value = {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      integer: 123,
      string: 'string',
    }

    expect(schema.safeParse(value)).toStrictEqual({
      success: true,
      value: {
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
        refToEnumWithDefault: 'option3',
      },
    })
  })

  it('rejects invalid enum values', () => {
    const schema = getSchema(
      'com.example.kitchenSink#object',
      l.TypedObjectSchema,
    )

    const value = {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      integer: 123,
      string: 'string',
      refToEnumWithDefault: 'invalidOption',
    }

    expect(schema.safeParse(value)).toMatchObject({
      success: false,
      reason: {
        issues: [
          {
            code: 'invalid_value',
            input: 'invalidOption',
            values: ['option1', 'option2', 'option3'],
          },
        ],
      },
    })
  })

  it('does not apply defaults when validating', () => {
    const schema = getSchema(
      'com.example.kitchenSink#object',
      l.TypedObjectSchema,
    )

    const value = {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      integer: 123,
      string: 'string',
    }

    expect(schema.safeValidate(value)).toStrictEqual({
      success: true,
      value: {
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
      },
    })
  })

  it('allows missing optional record fields', () => {
    const schema = getSchema(
      'com.example.kitchenSink#object',
      l.TypedObjectSchema,
    )

    expect(
      schema.matches({
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
      }),
    ).toBe(true)
  })

  it('Rejects missing required record fields', () => {
    const schema = getSchema(
      'com.example.kitchenSink#object',
      l.TypedObjectSchema,
    )

    const value = {
      object: { boolean: true },
      // array: ['one', 'two'],
      boolean: true,
      integer: 123,
      string: 'string',
    }

    expect(schema.safeParse(value)).toMatchObject({
      success: false,
      reason: { issues: [{ code: 'required_key', key: 'array' }] },
    })
  })

  it('fails validation when ref uri has multiple hash segments', async () => {
    const schema: LexiconDocument = {
      lexicon: 1,
      id: 'com.example.invalid',
      defs: {
        main: {
          type: 'object',
          properties: {
            test: { type: 'ref', ref: 'com.example.invalid#test#test' },
          },
        },
      },
    }

    await expect(async () => {
      await LexiconSchemaBuilder.buildAll(new LexiconIterableIndexer([schema]))
    }).rejects.toThrow('Uri can only have one hash segment')
  })

  it('fails lexicon parsing when uri is invalid', async () => {
    const schema: LexiconDocument = {
      lexicon: 1,
      id: 'com.example.invalid',
      defs: {
        main: {
          type: 'object',
          properties: {
            test: { type: 'ref', ref: 'com.example.missing#main' },
          },
        },
      },
    }

    await expect(async () => {
      await LexiconSchemaBuilder.buildAll(new LexiconIterableIndexer([schema]))
    }).rejects.toThrow('Lexicon com.example.missing not found')
  })

  it('fails lexicon parsing when uri is invalid', async () => {
    const schema: LexiconDocument = {
      lexicon: 1,
      id: 'com.example.invalid',
      defs: {
        main: {
          type: 'object',
          properties: {
            test: { type: 'ref', ref: 'com.example.invalid#nonexistent' },
          },
        },
      },
    }

    await expect(async () => {
      await LexiconSchemaBuilder.buildAll(new LexiconIterableIndexer([schema]))
    }).rejects.toThrow(
      'No definition found for hash ""nonexistent"" in com.example.invalid',
    )
  })
})
