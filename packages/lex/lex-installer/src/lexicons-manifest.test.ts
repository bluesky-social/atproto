import { lexiconsManifestSchema } from './lexicons-manifest.js'

describe('lexiconsManifestSchema', () => {
  it('parses a valid manifest', () => {
    expect(() =>
      lexiconsManifestSchema.parse({
        version: 1,
        lexicons: ['com.example.lexicon'],
        resolutions: {
          'com.example.lexicon': {
            uri: 'at://did:plc:foobar/com.atproto.lexicon.schema/com.example.lexicon',
            cid: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
          },
        },
      }),
    ).toEqual({
      version: 1,
      lexicons: ['com.example.lexicon'],
      resolutions: {
        'com.example.lexicon': {
          uri: 'at://did:plc:foobar/com.atproto.lexicon.schema/com.example.lexicon',
          cid: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
        },
      },
    })
  })
})
