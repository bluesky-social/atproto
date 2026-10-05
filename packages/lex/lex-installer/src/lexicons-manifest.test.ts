import { describe, expect, it } from 'vitest'
import {
  lexiconsManifestSchema,
  normalizeLexiconsManifest,
} from './lexicons-manifest.js'

describe('lexiconsManifestSchema', () => {
  it('parses a valid manifest', () => {
    expect(
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

  it('rejects an invalid manifest', () => {
    expect(() =>
      lexiconsManifestSchema.parse({
        version: 1,
        lexicons: ['com.example.lexicon'],
        resolutions: {
          'com.example.lexicon': {
            uri: 'invalid-uri',
            cid: 'not-a-cid',
          },
        },
      }),
    ).toThrow()

    expect(() =>
      lexiconsManifestSchema.parse({
        version: 2,
        lexicons: ['com.example.lexicon'],
        resolutions: {},
      }),
    ).toThrow()
  })

  it('parses a `resolvers` array (with glob include/exclude) and `file://` lock uris', () => {
    const manifest = {
      version: 1 as const,
      lexicons: ['com.example.lexicon'],
      resolvers: [
        {
          type: 'directory' as const,
          path: '../../lexicons',
          include: ['com.example.*'],
          exclude: ['com.example.secret'],
        },
      ],
      resolutions: {
        'com.example.lexicon': {
          uri: 'file://../../lexicons/com/example/lexicon.json',
          cid: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
        },
      },
    }
    expect(lexiconsManifestSchema.parse(manifest)).toEqual(manifest)
  })

  it('rejects an unknown resolver type', () => {
    expect(() =>
      lexiconsManifestSchema.parse({
        version: 1,
        lexicons: [],
        resolvers: [{ type: 'repo', path: 'x' }],
        resolutions: {},
      }),
    ).toThrow()
  })
})

describe('normalizeLexiconsManifest', () => {
  it('sorts lexicons and resolutions but preserves resolver order', () => {
    const normalized = normalizeLexiconsManifest({
      version: 1,
      lexicons: ['com.example.b', 'com.example.a'],
      resolvers: [
        { type: 'directory', path: './second' },
        { type: 'directory', path: './first' },
      ],
      resolutions: {
        'com.example.b': {
          uri: 'file://b.json',
          cid: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
        },
        'com.example.a': {
          uri: 'file://a.json',
          cid: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
        },
      },
    })

    expect(normalized.lexicons).toEqual(['com.example.a', 'com.example.b'])
    expect(Object.keys(normalized.resolutions)).toEqual([
      'com.example.a',
      'com.example.b',
    ])
    // Priority order is significant — not sorted.
    expect(normalized.resolvers?.map((r) => r.path)).toEqual([
      './second',
      './first',
    ])
  })

  it('omits the `resolvers` key entirely when absent or empty', () => {
    expect(
      'resolvers' in
        normalizeLexiconsManifest({
          version: 1,
          lexicons: [],
          resolvers: [],
          resolutions: {},
        }),
    ).toBe(false)
  })
})
