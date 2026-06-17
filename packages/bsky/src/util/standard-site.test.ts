import { describe, expect, it } from 'vitest'
import { validateStandardSiteForUrl } from './standard-site.js'

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
