import { Code } from '@connectrpc/connect'
import { describe, expect, test } from 'vitest'
import { extractNormalizedLxm, statusCodeToString } from './util.js'

describe(statusCodeToString, () => {
  test('success is spelled out, since Code has no member for it', () => {
    expect(statusCodeToString(undefined)).toBe('ok')
  })

  test.each([
    { code: Code.NotFound, expected: 'not_found' },
    { code: Code.DeadlineExceeded, expected: 'deadline_exceeded' },
    { code: Code.ResourceExhausted, expected: 'resource_exhausted' },
    { code: Code.Unavailable, expected: 'unavailable' },
  ])('$expected', ({ code, expected }) => {
    expect(statusCodeToString(code)).toBe(expected)
  })

  test('unknown numeric code falls back to its digits', () => {
    expect(statusCodeToString(9999 as Code)).toBe('9999')
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
