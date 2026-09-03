import { describe, expect, test } from 'vitest'
import { extractNormalizedLxm, statusCodeToString } from './util.js'

describe(statusCodeToString, () => {
  test('success is spelled out, since the Code enum has no member for it', () => {
    expect(statusCodeToString(undefined)).toBe('ok')
  })

  test.each([
    { code: 1, expected: 'canceled' },
    { code: 2, expected: 'unknown' },
    { code: 3, expected: 'invalid_argument' },
    { code: 4, expected: 'deadline_exceeded' },
    { code: 5, expected: 'not_found' },
    { code: 6, expected: 'already_exists' },
    { code: 7, expected: 'permission_denied' },
    { code: 8, expected: 'resource_exhausted' },
    { code: 9, expected: 'failed_precondition' },
    { code: 10, expected: 'aborted' },
    { code: 11, expected: 'out_of_range' },
    { code: 12, expected: 'unimplemented' },
    { code: 13, expected: 'internal' },
    { code: 14, expected: 'unavailable' },
    { code: 15, expected: 'data_loss' },
    { code: 16, expected: 'unauthenticated' },
  ])('$expected', ({ code, expected }) => {
    expect(statusCodeToString(code)).toBe(expected)
  })

  test('unknown numeric code falls back to its digits', () => {
    expect(statusCodeToString(9999)).toBe('9999')
  })
})

describe(extractNormalizedLxm, () => {
  test.each([
    {
      note: 'simple method',
      url: '/xrpc/com.example.foo',
      lxm: 'com.example.foo',
    },
    {
      note: 'with query string',
      url: '/xrpc/com.example.foo?limit=10&cursor=abc',
      lxm: 'com.example.foo',
    },
    {
      note: 'trailing slash',
      url: '/xrpc/com.example.foo/',
      lxm: 'com.example.foo',
    },
    {
      note: 'trailing slash with query',
      url: '/xrpc/com.example.foo/?a=1',
      lxm: 'com.example.foo',
    },
    {
      note: 'authority lowercased, name segment preserved',
      url: '/xrpc/Com.Example.fooBar',
      lxm: 'com.example.fooBar',
    },
    {
      note: 'shortest valid nsid',
      url: '/xrpc/a.b.c',
      lxm: 'a.b.c',
    },
  ])('$note', ({ url, lxm }) => {
    expect(extractNormalizedLxm(url)).toBe(lxm)
  })

  test.each([
    { note: 'non-string input', url: undefined },
    { note: 'null input', url: null },
    { note: 'number input', url: 42 },
    { note: 'not an xrpc path', url: '/foo/bar' },
    { note: 'too short', url: '/xrpc/' },
    { note: 'health check (underscore)', url: '/xrpc/_health' },
    { note: 'leading dot', url: '/xrpc/.foo' },
    { note: 'double slash', url: '/xrpc//foo' },
    { note: 'immediate query', url: '/xrpc/?foo=bar' },
    { note: 'extra path segment', url: '/xrpc/com.example.foo/bar' },
    { note: 'no dot in method', url: '/xrpc/foobar' },
    { note: 'trailing dot', url: '/xrpc/com.example.' },
  ])('$note → undefined', ({ url }) => {
    expect(extractNormalizedLxm(url)).toBeUndefined()
  })
})
