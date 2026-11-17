import { describe, expect, it } from 'vitest'
import { type AtUriString, type TypedLexMap, atUri } from '@atproto/lex'
import {
  type ExactRecordKey,
  type ExternalRecord,
  genericRecordKey,
} from '../../hydration/external.js'
import { HydrationMap } from '../../hydration/util.js'
import { site, social } from '../../lexicons/index.js'
import { validateExternalEmbedRecord } from './validation.js'

const author = 'did:plc:author'
const docUri = atUri(author, site.standard.document.$type, 'article')
const pubUri = atUri(author, site.standard.publication.$type, 'publication')
const cid = 'bafyreie5sviu7eeu3vf6n3lrlmqef2vdlwmgzd6zpolov56agdxtshdpda'
const otherCid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const docRef = { uri: docUri, cid }
const pubRef = { uri: pubUri, cid }
const pubUrl = 'https://example.com/blog'
const docUrl = `${pubUrl}/article`
const publishedAt = '2026-01-01T00:00:00.000Z'

function info(record: TypedLexMap, version = cid): ExternalRecord {
  return {
    record,
    cid: version,
    indexedAt: new Date(publishedAt),
    sortedAt: new Date(publishedAt),
    takedownRef: undefined,
  }
}

function stateOf() {
  const document = info(
    site.standard.document.$build({
      site: pubUri,
      path: '/article',
      title: 'Article',
      publishedAt,
    }),
  )
  const publication = info(
    site.standard.publication.$build({ name: 'Publication', url: pubUrl }),
  )
  return {
    externalRecords: new HydrationMap<AtUriString, ExternalRecord>([
      [docUri, document],
      [pubUri, publication],
    ]),
    externalRecordsByRef: new HydrationMap<ExactRecordKey, ExternalRecord>([
      [genericRecordKey(docRef), document],
      [genericRecordKey(pubRef), publication],
    ]),
  }
}

describe(validateExternalEmbedRecord, () => {
  it.each([
    { ref: { uri: docUri }, url: docUrl },
    { ref: docRef, url: docUrl },
    { ref: { uri: pubUri }, url: pubUrl },
    { ref: pubRef, url: pubUrl },
  ])('validates a latest or pinned Standard.site root: %j', ({ ref, url }) => {
    const state = stateOf()
    expect(validateExternalEmbedRecord({ ref, url, state })).toBe(true)
    expect(
      validateExternalEmbedRecord({ ref, url: 'https://other.example', state }),
    ).toBe(false)
  })

  it('validates the selected pin rather than the latest version at that URI', () => {
    const state = stateOf()
    const latestUrl = 'https://other.example/latest'
    state.externalRecords.set(
      docUri,
      info(
        site.standard.document.$build({
          site: 'https://other.example',
          path: '/latest',
          title: 'Latest',
          publishedAt,
        }),
        otherCid,
      ),
    )
    expect(
      validateExternalEmbedRecord({ ref: docRef, url: docUrl, state }),
    ).toBe(true)
    expect(
      validateExternalEmbedRecord({ ref: docRef, url: latestUrl, state }),
    ).toBe(false)
    expect(
      validateExternalEmbedRecord({
        ref: { uri: docUri },
        url: latestUrl,
        state,
      }),
    ).toBe(true)
  })

  it.each(['missing', 'nulled'])(
    'never falls back to latest for a %s pin',
    (status) => {
      const state = stateOf()
      const key = genericRecordKey(docRef)
      if (status === 'missing') state.externalRecordsByRef.delete(key)
      else state.externalRecordsByRef.set(key, null)
      expect(
        validateExternalEmbedRecord({ ref: docRef, url: docUrl, state }),
      ).toBe(false)
      expect(
        validateExternalEmbedRecord({
          ref: { uri: docUri },
          url: docUrl,
          state,
        }),
      ).toBe(true)
    },
  )

  it('uses the latest publication dependency, not an authored publication pin', () => {
    const state = stateOf()
    state.externalRecords.set(
      pubUri,
      info(
        site.standard.publication.$build({
          name: 'Moved',
          url: 'https://new.example/blog',
        }),
        otherCid,
      ),
    )
    expect(
      validateExternalEmbedRecord({
        ref: docRef,
        url: 'https://new.example/blog/article',
        state,
      }),
    ).toBe(true)
    expect(
      validateExternalEmbedRecord({ ref: docRef, url: docUrl, state }),
    ).toBe(false)
    expect(
      validateExternalEmbedRecord({ ref: pubRef, url: pubUrl, state }),
    ).toBe(true)
  })

  it('rejects a missing publication instead of substituting an unrelated one', () => {
    const state = stateOf()
    const publication = state.externalRecords.get(pubUri)!
    state.externalRecords.delete(pubUri)
    state.externalRecords.set(
      atUri(author, site.standard.publication.$type, 'other'),
      publication,
    )
    expect(
      validateExternalEmbedRecord({ ref: docRef, url: docUrl, state }),
    ).toBe(false)
  })

  it('accepts a web-URL document without a publication, independently of its title', () => {
    const state = stateOf()
    state.externalRecordsByRef.set(
      genericRecordKey(docRef),
      info(
        site.standard.document.$build({
          site: pubUrl,
          path: '/article',
          title: '',
          publishedAt,
        }),
      ),
    )
    state.externalRecords.delete(pubUri)
    expect(
      validateExternalEmbedRecord({ ref: docRef, url: docUrl, state }),
    ).toBe(true)
  })

  it('rejects a record whose type does not match its collection', () => {
    const state = stateOf()
    state.externalRecordsByRef.set(
      genericRecordKey(docRef),
      info(
        social.grain.gallery.$build({
          title: 'Gallery',
          createdAt: publishedAt,
        }),
      ),
    )
    expect(
      validateExternalEmbedRecord({ ref: docRef, url: docUrl, state }),
    ).toBe(false)
  })

  it('preserves record types that have no embedded-URL validator yet', () => {
    const state = stateOf()
    const uri = atUri(author, social.grain.gallery.$type, 'gallery')
    const ref = { uri, cid }
    state.externalRecordsByRef.set(
      genericRecordKey(ref),
      info(
        social.grain.gallery.$build({
          title: 'Gallery',
          createdAt: publishedAt,
        }),
      ),
    )
    expect(
      validateExternalEmbedRecord({ ref, url: 'https://other.example', state }),
    ).toBe(true)
  })
})
