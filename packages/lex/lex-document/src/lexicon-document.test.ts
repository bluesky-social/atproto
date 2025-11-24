import { lexiconDocumentSchema } from './lexicon-document.js'

describe('General validation', () => {
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

    expect(lexiconDocumentSchema.validate(value)).toStrictEqual({
      success: true,
      value,
    })
  })
})
