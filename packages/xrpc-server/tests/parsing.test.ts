import { parseUrlNsid } from '../src/util'

const testValid = (url: string, expected: string) => {
  expect(parseUrlNsid(url)).toBe(expected)
}

const testInvalid = (url: string, errorMessage = 'invalid xrpc path') => {
  expect(() => parseUrlNsid(url)).toThrow(errorMessage)
}

describe('parseUrlNsid', () => {
  it('should extract the NSID from the URL', () => {
    testValid('/xrpc/blee.blah.bloo', 'blee.blah.bloo')
    testValid('/xrpc/blee.blah.bloo?foo[]', 'blee.blah.bloo')
    testValid('/xrpc/blee.blah.bloo?foo=bar', 'blee.blah.bloo')
    testValid('/xrpc/com.example.nsid', 'com.example.nsid')
    testValid('/xrpc/com.example.nsid?foo=bar', 'com.example.nsid')
    testValid('/xrpc/com.example-domain.nsid', 'com.example-domain.nsid')
  })

  it('should allow a trailing slash', () => {
    testValid('/xrpc/blee.blah.bloo/?', 'blee.blah.bloo')
    testValid('/xrpc/blee.blah.bloo/?foo=', 'blee.blah.bloo')
    testValid('/xrpc/blee.blah.bloo/?bool', 'blee.blah.bloo')
    testValid('/xrpc/com.example.nsid/', 'com.example.nsid')
  })

  it('should throw an error if the URL is too short', () => {
    testInvalid('/xrpc/a')
  })

  it('should throw an error if the URL is empty', () => {
    testInvalid('')
  })

  it('should throw an error if the URL is missing the NSID', () => {
    testInvalid('/xrpc/')
    testInvalid('/xrpc/?')
    testInvalid('/xrpc/?foo=bar')
  })

  it('should throw an error if the URL contains extra path segments', () => {
    testInvalid('/xrpc/123/extra')
    testInvalid('/xrpc/123/extra?foo=bar')
  })

  it('should throw an error if the URL is missing the XRPC path prefix', () => {
    testInvalid('/foo/123')
    testInvalid('/foo/com.example.nsid')
  })

  it('should throw an error if the NSID starts with a dot', () => {
    testInvalid('/xrpc/.')
    testInvalid('/xrpc/..')
    testInvalid('/xrpc/....')
    testInvalid('/xrpc/.com.example.nsid')
    testInvalid('/xrpc/com..example.nsid')
    testInvalid('/xrpc/com.example..nsid')
    testInvalid('/xrpc/com.example.nsid.')
    testInvalid('/xrpc/com.example.nsid./')
    testInvalid('/xrpc/com.example.nsid.?foo=bar')
    testInvalid('/xrpc/com.example.nsid./?foo=bar')
  })

  it('should throw an error if the NSID contains a misplaced dash', () => {
    testInvalid('/xrpc/-')
    testInvalid('/xrpc/com.example.-nsid')
    testInvalid('/xrpc/com.example-.nsid')
    testInvalid('/xrpc/com.-example.nsid')
    testInvalid('/xrpc/com.-example-.nsid')
    testInvalid('/xrpc/com.example.nsid-')
    testInvalid('/xrpc/-com.example.nsid')
    testInvalid('/xrpc/com.example--domain.nsid')
  })

  it('should throw an error if the URL starts with a space', () => {
    testInvalid(' /xrpc/com.example.nsid')
  })

  it('should throw an error if the NSID contains invalid characters', () => {
    testInvalid('/xrpc/com.example.nsid#')
    testInvalid('/xrpc/com.example.nsid!')
    testInvalid('/xrpc/com.example#?nsid')
    testInvalid('/xrpc/!com.example.nsid')
    testInvalid('/xrpc/com.example.nsid ')
    testInvalid('/xrpc/ com.example.nsid')
    testInvalid('/xrpc/com. example.nsid')
  })
})
