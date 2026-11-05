import { describe, expect, it } from 'vitest'
import type { AtUriString } from '@atproto/lex'
import type { ExternalRecord } from '../../hydration/external.js'
import { HydrationMap } from '../../hydration/util.js'
import {
  getStandardSiteRecordsForUri,
  validateStandardSiteForUrl,
  validateStandardSiteRecordsForUrl,
} from './standard-site.js'

const docDid = 'did:plc:doc'
const pubDid = 'did:plc:pub'
const docUri = `at://${docDid}/site.standard.document/abc`
const pubUri = `at://${pubDid}/site.standard.publication/self`

const makeDoc = (record: { site: string; path?: string }) => ({
  ref: { uri: docUri },
  info: { record },
})

const makePub = (record: { url: string }) => ({
  ref: { uri: pubUri },
  info: { record },
})

describe(validateStandardSiteForUrl, () => {
  describe('document + publication', () => {
    it('accepts when site resolves to publication and url+path matches', () => {
      const doc = makeDoc({ site: pubUri, path: '/posts/hello' })
      const pub = makePub({ url: 'https://example.com' })
      expect(
        validateStandardSiteForUrl(doc, pub, 'https://example.com/posts/hello'),
      ).toBe(true)
    })

    it('rejects when joined url+path does not match assumedUrl', () => {
      const doc = makeDoc({ site: pubUri, path: '/posts/hello' })
      const pub = makePub({ url: 'https://example.com' })
      expect(
        validateStandardSiteForUrl(
          doc,
          pub,
          'https://example.com/posts/different',
        ),
      ).toBe(false)
    })

    it('accepts when document has no path and assumedUrl is the bare publication url', () => {
      const doc = makeDoc({ site: pubUri })
      const pub = makePub({ url: 'https://example.com' })
      expect(validateStandardSiteForUrl(doc, pub, 'https://example.com')).toBe(
        true,
      )
    })
  })

  describe('document only (loose doc)', () => {
    it('accepts when site is HTTP and matches assumedUrl', () => {
      const doc = makeDoc({ site: 'https://example.com', path: '/posts/hi' })
      expect(
        validateStandardSiteForUrl(
          doc,
          undefined,
          'https://example.com/posts/hi',
        ),
      ).toBe(true)
    })

    // The lookups reject this pairing upstream, but validate as a fallback:
    // an at-uri base canonicalizes to null and fails the URL match.
    it('rejects when site is an at-uri (non-HTTP base canonicalizes to null)', () => {
      const doc = makeDoc({ site: pubUri, path: '/posts/hi' })
      expect(
        validateStandardSiteForUrl(
          doc,
          undefined,
          'https://example.com/posts/hi',
        ),
      ).toBe(false)
    })

    it('rejects when assumedUrl is on a different host', () => {
      const doc = makeDoc({ site: 'https://example.com', path: '/posts/hi' })
      expect(
        validateStandardSiteForUrl(doc, undefined, 'https://evil.com/posts/hi'),
      ).toBe(false)
    })

    it('accepts when site has no path field and assumedUrl is the bare site', () => {
      const doc = makeDoc({ site: 'https://example.com' })
      expect(
        validateStandardSiteForUrl(doc, undefined, 'https://example.com'),
      ).toBe(true)
    })
  })

  describe('publication only', () => {
    it('accepts when publication.url matches assumedUrl', () => {
      const pub = makePub({ url: 'https://example.com' })
      expect(
        validateStandardSiteForUrl(undefined, pub, 'https://example.com'),
      ).toBe(true)
    })

    it('rejects when publication.url and assumedUrl differ', () => {
      const pub = makePub({ url: 'https://example.com' })
      expect(
        validateStandardSiteForUrl(undefined, pub, 'https://other.com'),
      ).toBe(false)
    })

    it('accepts when assumedUrl has a trailing slash and publication.url does not', () => {
      const pub = makePub({ url: 'https://atproto.com/blog' })
      expect(
        validateStandardSiteForUrl(undefined, pub, 'https://atproto.com/blog/'),
      ).toBe(true)
    })
  })

  describe('neither', () => {
    it('returns true (caller handles the no-records short-circuit)', () => {
      expect(
        validateStandardSiteForUrl(undefined, undefined, 'https://example.com'),
      ).toBe(true)
    })
  })

  describe('assumedUrl variants', () => {
    const doc = makeDoc({ site: pubUri, path: '/posts/hello' })
    const pub = makePub({ url: 'https://example.com' })

    for (const { note, assumedUrl, expected } of [
      {
        note: 'trailing slash on assumed URL',
        assumedUrl: 'https://example.com/posts/hello/',
        expected: true,
      },
      {
        note: 'query string ignored',
        assumedUrl: 'https://example.com/posts/hello?utm_source=twitter',
        expected: true,
      },
      {
        note: 'fragment ignored',
        assumedUrl: 'https://example.com/posts/hello#section',
        expected: true,
      },
      {
        note: 'mixed-case host',
        assumedUrl: 'https://Example.COM/posts/hello',
        expected: true,
      },
      {
        note: 'http vs https mismatch is rejected',
        assumedUrl: 'http://example.com/posts/hello',
        expected: false,
      },
      {
        note: 'unparseable assumed URL is rejected',
        assumedUrl: 'not a url',
        expected: false,
      },
      {
        note: 'non-http scheme is rejected',
        assumedUrl: 'ftp://example.com/posts/hello',
        expected: false,
      },
    ]) {
      it(note, () => {
        expect(validateStandardSiteForUrl(doc, pub, assumedUrl)).toBe(expected)
      })
    }
  })

  describe('path joining (root domain × subpath × slash placement)', () => {
    // Real-world example that originally broke:
    //   pub.url:  'https://atproto.com/blog'
    //   doc.path: '/indexing-standard-site'
    //   expected: 'https://atproto.com/blog/indexing-standard-site'
    // `new URL('/indexing-standard-site', 'https://atproto.com/blog')` would
    // resolve to 'https://atproto.com/indexing-standard-site' (the leading
    // slash on path swallows the base's pathname under WHATWG semantics) —
    // we want path-append, not relative resolution.
    for (const { note, baseUrl, path, assumedUrl, expected } of [
      // Root-domain base, all four slash combinations.
      {
        note: 'root base, base/, path/',
        baseUrl: 'https://example.com/',
        path: '/posts/hello',
        assumedUrl: 'https://example.com/posts/hello',
        expected: true,
      },
      {
        note: 'root base, base/, path-no-slash',
        baseUrl: 'https://example.com/',
        path: 'posts/hello',
        assumedUrl: 'https://example.com/posts/hello',
        expected: true,
      },
      {
        note: 'root base, base-no-slash, path/',
        baseUrl: 'https://example.com',
        path: '/posts/hello',
        assumedUrl: 'https://example.com/posts/hello',
        expected: true,
      },
      {
        note: 'root base, base-no-slash, path-no-slash',
        baseUrl: 'https://example.com',
        path: 'posts/hello',
        assumedUrl: 'https://example.com/posts/hello',
        expected: true,
      },
      // Subpath base, all four slash combinations (the regression case).
      {
        note: 'subpath base, base/, path/',
        baseUrl: 'https://atproto.com/blog/',
        path: '/indexing-standard-site',
        assumedUrl: 'https://atproto.com/blog/indexing-standard-site',
        expected: true,
      },
      {
        note: 'subpath base, base/, path-no-slash',
        baseUrl: 'https://atproto.com/blog/',
        path: 'indexing-standard-site',
        assumedUrl: 'https://atproto.com/blog/indexing-standard-site',
        expected: true,
      },
      {
        note: 'subpath base, base-no-slash, path/ (regression)',
        baseUrl: 'https://atproto.com/blog',
        path: '/indexing-standard-site',
        assumedUrl: 'https://atproto.com/blog/indexing-standard-site',
        expected: true,
      },
      {
        note: 'subpath base, base-no-slash, path-no-slash',
        baseUrl: 'https://atproto.com/blog',
        path: 'indexing-standard-site',
        assumedUrl: 'https://atproto.com/blog/indexing-standard-site',
        expected: true,
      },
      // Empty path: assumedUrl should equal the base.
      {
        note: 'empty path, root base, no trailing slash',
        baseUrl: 'https://example.com',
        path: undefined,
        assumedUrl: 'https://example.com',
        expected: true,
      },
      {
        note: 'empty path, subpath base, with trailing slash',
        baseUrl: 'https://atproto.com/blog/',
        path: undefined,
        assumedUrl: 'https://atproto.com/blog',
        expected: true,
      },
      // Negative: subpath base with assumedUrl that lost the subpath
      // (what `new URL`'s relative resolution would have produced).
      {
        note: 'rejects when assumed URL drops the subpath',
        baseUrl: 'https://atproto.com/blog',
        path: '/indexing-standard-site',
        assumedUrl: 'https://atproto.com/indexing-standard-site',
        expected: false,
      },
    ]) {
      it(`doc + pub: ${note}`, () => {
        const doc = makeDoc(
          path === undefined ? { site: pubUri } : { site: pubUri, path },
        )
        const pub = makePub({ url: baseUrl })
        expect(validateStandardSiteForUrl(doc, pub, assumedUrl)).toBe(expected)
      })
      it(`loose doc: ${note}`, () => {
        const doc = makeDoc(
          path === undefined ? { site: baseUrl } : { site: baseUrl, path },
        )
        expect(validateStandardSiteForUrl(doc, undefined, assumedUrl)).toBe(
          expected,
        )
      })
    }
  })

  describe('subpath-friendly hosts', () => {
    // Allowlist of hosts where each record's author owns the full subpath
    // space under their canonical record URL. These platforms typically
    // serve dynamic per-record subpaths (page numbers, revision ids,
    // comment threads, etc.) under the same slug, so an `assumedUrl` with
    // extra path segments past the record URL is still authentic content.
    for (const { note, baseUrl, path, assumedUrl, expected } of [
      // Allowlisted apex domain (subdomain) — extra path segments accepted.
      {
        note: 'pckt.blog subdomain accepts extra path segments past the record URL',
        baseUrl: 'https://waow-tech.pckt.blog',
        path: '/typeahead-more-like-typebehind-amirite-tzgmqge',
        assumedUrl:
          'https://waow-tech.pckt.blog/typeahead-more-like-typebehind-amirite-tzgmqge/589/621',
        expected: true,
      },
      {
        note: 'leaflet.pub subdomain with one extra segment',
        baseUrl: 'https://author.leaflet.pub',
        path: '/post-slug',
        assumedUrl: 'https://author.leaflet.pub/post-slug/v2',
        expected: true,
      },
      {
        note: 'offprint.app at apex with multi-segment extension',
        baseUrl: 'https://offprint.app',
        path: '/story/abc',
        assumedUrl: 'https://offprint.app/story/abc/chapter/3',
        expected: true,
      },
      // Allowlisted host but the assumed URL diverges from the path —
      // still rejected; subpath is "extends with extra segments after a
      // path-segment boundary," not "any URL on the same host."
      {
        note: 'pckt.blog rejects assumed URLs that diverge before the boundary',
        baseUrl: 'https://blog.pckt.blog',
        path: '/post-slug',
        assumedUrl: 'https://blog.pckt.blog/different-post',
        expected: false,
      },
      {
        note: 'pckt.blog rejects partial-segment matches (no slash boundary)',
        baseUrl: 'https://blog.pckt.blog',
        path: '/foo',
        assumedUrl: 'https://blog.pckt.blog/foobar',
        expected: false,
      },
      // Non-allowlisted hosts — exact match still required.
      {
        note: 'arbitrary host rejects extra path segments',
        baseUrl: 'https://example.com',
        path: '/article',
        assumedUrl: 'https://example.com/article/extra',
        expected: false,
      },
      {
        note: 'lookalike host (pckt.blog.evil.com) is NOT allowlisted',
        baseUrl: 'https://pckt.blog.evil.com',
        path: '/post',
        assumedUrl: 'https://pckt.blog.evil.com/post/extra',
        expected: false,
      },
      {
        note: 'evilpckt.blog is NOT allowlisted (no subdomain dot before pckt.blog)',
        baseUrl: 'https://evilpckt.blog',
        path: '/post',
        assumedUrl: 'https://evilpckt.blog/post/extra',
        expected: false,
      },
      // Allowlist host with exact match still works (no regression).
      {
        note: 'pckt.blog still accepts exact match without subpath',
        baseUrl: 'https://author.pckt.blog',
        path: '/post-slug',
        assumedUrl: 'https://author.pckt.blog/post-slug',
        expected: true,
      },
      // Allowlist host with cross-host mismatch — still rejected.
      {
        note: 'allowlisted record host vs different host on assumed URL is rejected',
        baseUrl: 'https://author.pckt.blog',
        path: '/post',
        assumedUrl: 'https://example.com/author.pckt.blog/post/extra',
        expected: false,
      },
    ]) {
      it(`doc + pub: ${note}`, () => {
        const doc = makeDoc(
          path === undefined ? { site: pubUri } : { site: pubUri, path },
        )
        const pub = makePub({ url: baseUrl })
        expect(validateStandardSiteForUrl(doc, pub, assumedUrl)).toBe(expected)
      })
      it(`loose doc: ${note}`, () => {
        const doc = makeDoc(
          path === undefined ? { site: baseUrl } : { site: baseUrl, path },
        )
        expect(validateStandardSiteForUrl(doc, undefined, assumedUrl)).toBe(
          expected,
        )
      })
    }

    // Publication-only validation never accepts subpaths — `assumedUrl`
    // for a publication is the home-page URL, not an article underneath
    // it. Subpath relaxation belongs to documents.
    it('publication-only: allowlisted host still requires exact match', () => {
      const pub = makePub({ url: 'https://author.pckt.blog' })
      expect(
        validateStandardSiteForUrl(
          undefined,
          pub,
          'https://author.pckt.blog/some/sub/path',
        ),
      ).toBe(false)
    })

    it('publication-only: non-allowlisted host rejects subpath', () => {
      const pub = makePub({ url: 'https://example.com' })
      expect(
        validateStandardSiteForUrl(
          undefined,
          pub,
          'https://example.com/some/sub/path',
        ),
      ).toBe(false)
    })

    // Case-insensitivity on the host.
    it('host comparison is case-insensitive', () => {
      const doc = makeDoc({
        site: pubUri,
        path: '/post',
      })
      const pub = makePub({ url: 'https://Author.PCKT.blog' })
      expect(
        validateStandardSiteForUrl(
          doc,
          pub,
          'https://author.pckt.BLOG/post/extra',
        ),
      ).toBe(true)
    })
  })
})

const docUriT = docUri as AtUriString
const pubUriT = pubUri as AtUriString

const stored = (
  record: Record<string, unknown>,
  cid: string,
): ExternalRecord => ({
  record: record as ExternalRecord['record'],
  cid,
  sortedAt: new Date(0),
  indexedAt: new Date(0),
  takedownRef: undefined,
})

const storedDoc = (site: string, extra: Record<string, unknown> = {}) =>
  stored(
    {
      $type: 'site.standard.document',
      site,
      title: 'Title',
      publishedAt: '2025-01-01T00:00:00.000Z',
      path: '/posts/hello',
      ...extra,
    },
    'bafydoc',
  )

const storedPub = (url = 'https://example.com') =>
  stored({ $type: 'site.standard.publication', url, name: 'Pub' }, 'bafypub')

const recordsOf = (entries: [string, ExternalRecord | null][]) =>
  new HydrationMap<AtUriString, ExternalRecord>(
    entries as [AtUriString, ExternalRecord | null][],
  )

describe(getStandardSiteRecordsForUri, () => {
  it('selects a document and the publication named by its site', () => {
    const doc = storedDoc(pubUri)
    const pub = storedPub()
    const sel = getStandardSiteRecordsForUri(
      docUriT,
      recordsOf([
        [docUri, doc],
        [pubUri, pub],
      ]),
    )
    expect(sel.document?.ref).toEqual({ uri: docUri, cid: 'bafydoc' })
    expect(sel.document?.info.record).toBe(doc.record)
    expect(sel.publication?.ref).toEqual({ uri: pubUri, cid: 'bafypub' })
    expect(sel.publication?.info.record).toBe(pub.record)
  })

  it('selects only the document for a web-URL site', () => {
    const sel = getStandardSiteRecordsForUri(
      docUriT,
      recordsOf([
        [docUri, storedDoc('https://example.com')],
        [pubUri, storedPub()],
      ]),
    )
    expect(sel.document).toBeDefined()
    expect(sel.publication).toBeUndefined()
  })

  it('selects only a canonical publication', () => {
    const sel = getStandardSiteRecordsForUri(
      pubUriT,
      recordsOf([
        [pubUri, storedPub()],
        [docUri, storedDoc(pubUri)],
      ]),
    )
    expect(sel.document).toBeUndefined()
    expect(sel.publication?.ref.uri).toBe(pubUri)
  })

  it('keeps the document when its publication is missing or null', () => {
    const missing = getStandardSiteRecordsForUri(
      docUriT,
      recordsOf([[docUri, storedDoc(pubUri)]]),
    )
    expect(missing.document).toBeDefined()
    expect(missing.publication).toBeUndefined()
    const nulled = getStandardSiteRecordsForUri(
      docUriT,
      recordsOf([
        [docUri, storedDoc(pubUri)],
        [pubUri, null],
      ]),
    )
    expect(nulled.document).toBeDefined()
    expect(nulled.publication).toBeUndefined()
  })

  it('keeps the document when the referenced publication body is invalid', () => {
    const sel = getStandardSiteRecordsForUri(
      docUriT,
      recordsOf([
        [docUri, storedDoc(pubUri)],
        [pubUri, stored({ $type: 'site.standard.publication', url: 1 }, 'x')],
      ]),
    )
    expect(sel.document).toBeDefined()
    expect(sel.publication).toBeUndefined()
  })

  it('selects nothing for an invalid body', () => {
    const bad = stored({ $type: 'site.standard.document', site: pubUri }, 'x')
    expect(
      getStandardSiteRecordsForUri(docUriT, recordsOf([[docUri, bad]])),
    ).toEqual({})
  })

  it('selects nothing when the body type does not match the URI collection', () => {
    expect(
      getStandardSiteRecordsForUri(docUriT, recordsOf([[docUri, storedPub()]])),
    ).toEqual({})
  })

  it('selects nothing for other collections, missing roots, or no records', () => {
    const other = `at://${docDid}/app.bsky.feed.post/abc` as AtUriString
    expect(
      getStandardSiteRecordsForUri(other, recordsOf([[other, storedPub()]])),
    ).toEqual({})
    expect(getStandardSiteRecordsForUri(docUriT, recordsOf([]))).toEqual({})
    expect(getStandardSiteRecordsForUri(docUriT, undefined)).toEqual({})
  })

  it('does not substitute unrelated hydrated records for the canonical URI', () => {
    const otherDoc =
      `at://${docDid}/site.standard.document/other` as AtUriString
    const otherPub =
      `at://${pubDid}/site.standard.publication/other` as AtUriString
    const records = recordsOf([
      [otherDoc, storedDoc(otherPub)],
      [otherPub, storedPub()],
    ])
    expect(getStandardSiteRecordsForUri(docUriT, records)).toEqual({})
    expect(getStandardSiteRecordsForUri(pubUriT, records)).toEqual({})
    // an unrelated publication is not used for a document naming a different one
    const sel = getStandardSiteRecordsForUri(
      docUriT,
      recordsOf([
        [docUri, storedDoc(pubUri)],
        [otherPub, storedPub()],
      ]),
    )
    expect(sel.document).toBeDefined()
    expect(sel.publication).toBeUndefined()
  })

  it('does not mutate the supplied records', () => {
    const doc = storedDoc(pubUri)
    const snapshot = structuredClone(doc.record)
    getStandardSiteRecordsForUri(docUriT, recordsOf([[docUri, doc]]))
    expect(doc.record).toEqual(snapshot)
  })
})

describe(validateStandardSiteRecordsForUrl, () => {
  const select = (entries: [string, ExternalRecord | null][], uri: string) =>
    getStandardSiteRecordsForUri(uri as AtUriString, recordsOf(entries))

  it('rejects when neither slot is present', () => {
    expect(
      validateStandardSiteRecordsForUrl(
        undefined,
        undefined,
        'https://example.com',
      ),
    ).toBe(false)
  })

  it('accepts a document with its matching publication', () => {
    const { document, publication } = select(
      [
        [docUri, storedDoc(pubUri)],
        [pubUri, storedPub()],
      ],
      docUri,
    )
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        publication,
        'https://example.com/posts/hello',
      ),
    ).toBe(true)
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        publication,
        'https://example.com/posts/other',
      ),
    ).toBe(false)
  })

  it('rejects a document whose publication is missing', () => {
    const { document, publication } = select(
      [[docUri, storedDoc(pubUri)]],
      docUri,
    )
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        publication,
        'https://example.com/posts/hello',
      ),
    ).toBe(false)
  })

  it('rejects a supplied publication the document does not name', () => {
    const { document } = select([[docUri, storedDoc(pubUri)]], docUri)
    const { publication } = select(
      [[`at://${pubDid}/site.standard.publication/other`, storedPub()]],
      `at://${pubDid}/site.standard.publication/other`,
    )
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        publication,
        'https://example.com/posts/hello',
      ),
    ).toBe(false)
  })

  it('accepts a web-URL document alone and rejects a URL mismatch', () => {
    const { document } = select(
      [[docUri, storedDoc('https://example.com')]],
      docUri,
    )
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        undefined,
        'https://example.com/posts/hello',
      ),
    ).toBe(true)
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        undefined,
        'https://evil.com/posts/hello',
      ),
    ).toBe(false)
  })

  it('rejects a web-URL document paired with a publication', () => {
    const { document } = select(
      [[docUri, storedDoc('https://example.com')]],
      docUri,
    )
    const { publication } = select([[pubUri, storedPub()]], pubUri)
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        publication,
        'https://example.com/posts/hello',
      ),
    ).toBe(false)
  })

  it('accepts a standalone publication on an exact URL only', () => {
    const { publication } = select([[pubUri, storedPub()]], pubUri)
    expect(
      validateStandardSiteRecordsForUrl(
        undefined,
        publication,
        'https://example.com/',
      ),
    ).toBe(true)
    expect(
      validateStandardSiteRecordsForUrl(
        undefined,
        publication,
        'https://example.com/other',
      ),
    ).toBe(false)
  })

  it('keeps platform subpath exceptions', () => {
    const { document, publication } = select(
      [
        [docUri, storedDoc(pubUri, { path: '/post' })],
        [pubUri, storedPub('https://author.pckt.blog')],
      ],
      docUri,
    )
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        publication,
        'https://author.pckt.blog/post/extra',
      ),
    ).toBe(true)
  })

  it('does not fail an empty title (renderability is not validated)', () => {
    const { document, publication } = select(
      [
        [docUri, storedDoc(pubUri, { title: '' })],
        [pubUri, storedPub()],
      ],
      docUri,
    )
    expect(
      validateStandardSiteRecordsForUrl(
        document,
        publication,
        'https://example.com/posts/hello',
      ),
    ).toBe(true)
  })
})
