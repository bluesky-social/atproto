import { parseUrlNsid } from '../src/util'

describe('parseUrlNsid', () => {
  it('should return the NSID from the URL', () => {
    expect(parseUrlNsid('/xrpc/123')).toBe('123')
    expect(parseUrlNsid('/xrpc/com.example.nsid')).toBe('com.example.nsid')
    expect(parseUrlNsid('/xrpc/com.example-domain.nsid')).toBe(
      'com.example-domain.nsid',
    )
  })

  it('should return the NSID from the URL with query parameters', () => {
    expect(parseUrlNsid('/xrpc/123?foo=bar')).toBe('123')
    expect(parseUrlNsid('/xrpc/com.example.nsid?foo=bar')).toBe(
      'com.example.nsid',
    )
  })

  it('should return the NSID from the URL with a trailing slash', () => {
    expect(parseUrlNsid('/xrpc/123/')).toBe('123')
    expect(parseUrlNsid('/xrpc/com.example.nsid/')).toBe('com.example.nsid')
  })

  it('should throw an error if the URL is too short', () => {
    expect(() => parseUrlNsid('/xrpc/a')).toThrow('invalid xrpc path')
  })

  it('should throw an error if the URL is empty', () => {
    expect(() => parseUrlNsid('')).toThrow('invalid xrpc path')
  })

  it('should throw an error if the URL is missing the XRPC path prefix', () => {
    expect(() => parseUrlNsid('/foo/123')).toThrow('invalid xrpc path')
    expect(() => parseUrlNsid('/foo/com.example.nsid')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID starts with a dot', () => {
    expect(() => parseUrlNsid('/xrpc/.com.example.nsid')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID contains double dots', () => {
    expect(() => parseUrlNsid('/xrpc/com..example.nsid')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID ends with a dot', () => {
    expect(() => parseUrlNsid('/xrpc/com.example.nsid.')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/com.example.nsid./')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/com.example.nsid.?foo=bar')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/com.example.nsid./?foo=bar')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID contains a dot followed by a dash', () => {
    expect(() => parseUrlNsid('/xrpc/com.example.-nsid')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID contains a dash followed by a dot', () => {
    expect(() => parseUrlNsid('/xrpc/com.example-.nsid')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID ends with a dash', () => {
    expect(() => parseUrlNsid('/xrpc/com.example.nsid-')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID starts with a dash', () => {
    expect(() => parseUrlNsid('/xrpc/-com.example.nsid')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID contains a double dash', () => {
    expect(() => parseUrlNsid('/xrpc/com.example--domain.nsid')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the URL is missing the NSID', () => {
    expect(() => parseUrlNsid('/xrpc/')).toThrow('invalid xrpc path')
  })

  it('should throw an error if the URL is missing the NSID with query parameters', () => {
    expect(() => parseUrlNsid('/xrpc/?foo=bar')).toThrow('invalid xrpc path')
  })

  it('should throw an error if the URL contains extra path segments', () => {
    expect(() => parseUrlNsid('/xrpc/123/extra')).toThrow('invalid xrpc path')
  })

  it('should throw an error if the URL contains extra path segments with query parameters', () => {
    expect(() => parseUrlNsid('/xrpc/123/extra?foo=bar')).toThrow(
      'invalid xrpc path',
    )
  })

  it('should throw an error if the NSID contains invalid characters', () => {
    expect(() => parseUrlNsid('/xrpc/com.example.nsid!')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/com.example#?nsid')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/!com.example.nsid')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/com.example.nsid ')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/ com.example.nsid')).toThrow(
      'invalid xrpc path',
    )
    expect(() => parseUrlNsid('/xrpc/com. example.nsid')).toThrow(
      'invalid xrpc path',
    )
  })
})
