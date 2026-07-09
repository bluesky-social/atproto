import type { IdResolver } from '@atproto/identity'
import {
  detectFacetsFromText,
  maybeEnrichPostFacets,
} from '../src/api/com/atproto/repo/detect-facets.js'

const enc = new TextEncoder()
const dec = new TextDecoder()
// substring of `text` covered by a facet's utf8 byte range
const sliceOf = (text: string, f: { index: { byteStart: number; byteEnd: number } }) =>
  dec.decode(enc.encode(text).slice(f.index.byteStart, f.index.byteEnd))

const typeOf = (f: { features: Array<Record<string, unknown>> }) =>
  f.features[0].$type

describe('detectFacetsFromText', () => {
  it('returns [] when there is nothing to detect', () => {
    expect(detectFacetsFromText('just some plain words here')).toEqual([])
  })

  it('detects a hashtag and stores the bare tag (byte range covers the #)', () => {
    const text = 'hello #world'
    const [facet] = detectFacetsFromText(text)
    expect(typeOf(facet)).toBe('app.bsky.richtext.facet#tag')
    expect(facet.features[0].tag).toBe('world')
    expect(sliceOf(text, facet)).toBe('#world')
  })

  it('detects a link and normalizes bare domains to https', () => {
    const text = 'see example.com for more'
    const [facet] = detectFacetsFromText(text)
    expect(typeOf(facet)).toBe('app.bsky.richtext.facet#link')
    expect(facet.features[0].uri).toBe('https://example.com')
    expect(sliceOf(text, facet)).toBe('example.com')
  })

  it('strips trailing punctuation from links', () => {
    const text = 'read https://atproto.com.'
    const [facet] = detectFacetsFromText(text)
    expect(facet.features[0].uri).toBe('https://atproto.com')
    expect(sliceOf(text, facet)).toBe('https://atproto.com')
  })

  it('keeps utf8 byte offsets correct when preceded by multi-byte text', () => {
    const text = 'emoji 🎉🎉 then #café tail'
    const [facet] = detectFacetsFromText(text)
    expect(facet.features[0].tag).toBe('café')
    // the byte range must still slice back to exactly "#café"
    expect(sliceOf(text, facet)).toBe('#café')
  })

  it('detects a mention with the handle in `did` (unresolved)', () => {
    const text = 'hi @alice.test how are you'
    const [facet] = detectFacetsFromText(text)
    expect(typeOf(facet)).toBe('app.bsky.richtext.facet#mention')
    expect(facet.features[0].did).toBe('alice.test')
    expect(sliceOf(text, facet)).toBe('@alice.test')
  })

  it('detects multiple hashtags', () => {
    const facets = detectFacetsFromText('#one #two #three')
    expect(facets.map((f) => f.features[0].tag)).toEqual(['one', 'two', 'three'])
  })
})

describe('maybeEnrichPostFacets', () => {
  const idResolver = {
    handle: {
      resolve: async (handle: string) =>
        handle === 'alice.test' ? 'did:plc:alice' : undefined,
    },
  } as unknown as IdResolver

  it('populates facets on a bare post record', async () => {
    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text: 'hello #world and https://atproto.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    await maybeEnrichPostFacets('app.bsky.feed.post', record, idResolver)
    expect(Array.isArray(record.facets)).toBe(true)
    const facets = record.facets as Array<{ features: Array<{ $type: string }> }>
    const types = facets.map((f) => f.features[0].$type)
    expect(types).toContain('app.bsky.richtext.facet#tag')
    expect(types).toContain('app.bsky.richtext.facet#link')
  })

  it('resolves mention handles to DIDs and drops unresolvable ones', async () => {
    const record: Record<string, unknown> = {
      text: 'hi @alice.test and @nobody.test',
    }
    await maybeEnrichPostFacets('app.bsky.feed.post', record, idResolver)
    const facets = record.facets as Array<{
      features: Array<{ $type: string; did?: string }>
    }>
    const mentions = facets.filter(
      (f) => f.features[0].$type === 'app.bsky.richtext.facet#mention',
    )
    // alice resolves; nobody.test does not and is dropped
    expect(mentions).toHaveLength(1)
    expect(mentions[0].features[0].did).toBe('did:plc:alice')
  })

  it('is a no-op when facets are already present', async () => {
    const existing = [{ marker: true }]
    const record: Record<string, unknown> = {
      text: 'hello #world',
      facets: existing,
    }
    await maybeEnrichPostFacets('app.bsky.feed.post', record, idResolver)
    expect(record.facets).toBe(existing)
  })

  it('is a no-op for non-post collections', async () => {
    const record: Record<string, unknown> = { text: 'hello #world' }
    await maybeEnrichPostFacets('app.bsky.feed.like', record, idResolver)
    expect(record.facets).toBeUndefined()
  })

  it('is a no-op when the text has no facets', async () => {
    const record: Record<string, unknown> = { text: 'plain words only' }
    await maybeEnrichPostFacets('app.bsky.feed.post', record, idResolver)
    expect(record.facets).toBeUndefined()
  })
})
