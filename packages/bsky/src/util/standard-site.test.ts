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

    // this case should never hit this function, but it's here as a fallback
    it('rejects when site does not resolve to the hydrated publication', () => {
      const doc = makeDoc({
        site: 'at://did:plc:other/site.standard.publication/self',
        path: '/posts/hello',
      })
      const pub = makePub({ url: 'https://example.com' })
      expect(
        validateStandardSiteForUrl(doc, pub, 'https://example.com/posts/hello'),
      ).toBe(false)
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
      expect(
        validateStandardSiteForUrl(doc, pub, 'https://example.com'),
      ).toBe(true)
    })
  })

  describe('document only (loose doc)', () => {
    it('accepts when site is HTTP and matches assumedUrl', () => {
      const doc = makeDoc({ site: 'https://example.com', path: '/posts/hi' })
      expect(
        validateStandardSiteForUrl(doc, undefined, 'https://example.com/posts/hi'),
      ).toBe(true)
    })

    // this case should never hit this function, but it's here as a fallback
    it('rejects when site is an at-uri (a publication ref) but no publication was hydrated', () => {
      const doc = makeDoc({ site: pubUri, path: '/posts/hi' })
      expect(
        validateStandardSiteForUrl(doc, undefined, 'https://example.com/posts/hi'),
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
  })

  describe('neither', () => {
    // this case should never hit this function, but it's here as a fallback
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

  describe('publication.url variants', () => {
    it('accepts when publication.url has trailing slash', () => {
      const doc = makeDoc({ site: pubUri, path: '/posts/hello' })
      const pub = makePub({ url: 'https://example.com/' })
      expect(
        validateStandardSiteForUrl(doc, pub, 'https://example.com/posts/hello'),
      ).toBe(true)
    })

    it('accepts when document.path lacks a leading slash', () => {
      const doc = makeDoc({ site: pubUri, path: 'posts/hello' })
      const pub = makePub({ url: 'https://example.com/' })
      expect(
        validateStandardSiteForUrl(doc, pub, 'https://example.com/posts/hello'),
      ).toBe(true)
    })

    it('handles publication.url with sub-path and document.path joining onto it', () => {
      const doc = makeDoc({ site: pubUri, path: 'hello' })
      const pub = makePub({ url: 'https://example.com/blog/' })
      expect(
        validateStandardSiteForUrl(doc, pub, 'https://example.com/blog/hello'),
      ).toBe(true)
    })
  })
})
