import { describe, expect, it } from 'vitest'
import { lexiconDocumentSchema } from './lexicon-document.js'

describe('lexiconDocumentSchema', () => {
  it('allows unknown fields to be present', () => {
    const value = {
      lexicon: 1,
      id: 'com.example.unknownFields',
      defs: {
        test: {
          type: 'object',
          properties: {},
          foo: 3,
        },
      },
    }

    expect(lexiconDocumentSchema.safeParse(value)).toStrictEqual({
      success: true,
      value,
    })
  })

  it('validates a minimal lexicons document', () => {
    expect(
      lexiconDocumentSchema.safeParse({
        lexicon: 1,
        id: 'com.example.lexicon',
        defs: {
          demo: {
            type: 'integer',
          },
        },
      }),
    ).toMatchObject({
      success: true,
    })
  })

  it('rejects lexicons with invalid lexicon field', () => {
    expect(
      lexiconDocumentSchema.safeParse({
        lexicon: 'one',
        id: 'com.example.lexicon',
        defs: {
          demo: {
            type: 'integer',
          },
        },
      }),
    ).toMatchObject({
      success: false,
      reason: { issues: [{ code: 'invalid_value', values: [1] }] },
    })
  })

  it('rejects lexicons with invalid NSID in id field', () => {
    expect(
      lexiconDocumentSchema.safeParse({
        lexicon: 1,
        id: 'not-an-nsid',
        defs: {
          demo: {
            type: 'integer',
          },
        },
      }),
    ).toMatchObject({
      success: false,
      reason: { issues: [{ code: 'invalid_format', format: 'nsid' }] },
    })
  })

  it('rejects lexicons with numeric id field', () => {
    expect(
      lexiconDocumentSchema.safeParse({
        lexicon: 1,
        id: 2,
        defs: {
          demo: {
            type: 'integer',
          },
        },
      }),
    ).toMatchObject({
      success: false,
      reason: { issues: [{ code: 'invalid_type', expected: ['string'] }] },
    })
  })

  it('rejects object defs with invalid required fields', () => {
    expect(
      lexiconDocumentSchema.safeParse({
        lexicon: 1,
        id: 'com.example.lexicon',
        defs: {
          demo: {
            type: 'object',
            properties: {
              foo: { type: 'string' },
            },
            required: ['bar'],
          },
        },
      }),
    ).toMatchObject({
      success: false,
      reason: {
        issues: [{ code: 'custom', path: ['defs', 'demo', 'required'] }],
      },
    })
  })
})
