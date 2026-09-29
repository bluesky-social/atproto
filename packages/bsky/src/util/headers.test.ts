import { describe, expect, it } from 'vitest'
import { getAtprotoPassthroughHeaders } from './headers.js'

describe(getAtprotoPassthroughHeaders, () => {
  it('passes x-atproto headers and omits unrelated headers', () => {
    expect(
      getAtprotoPassthroughHeaders({
        headers: {
          'x-atproto-foo': 'foo',
          'x-not-atproto': 'not forwarded',
        },
      }),
    ).toEqual({ 'x-atproto-foo': 'foo' })
  })

  it('maps the legacy topics header to x-atproto-bsky-topics', () => {
    expect(
      getAtprotoPassthroughHeaders({
        headers: { 'x-bsky-topics': ['one', 'two'] },
      }),
    ).toEqual({
      'x-atproto-bsky-topics': 'one,two',
      'x-bsky-topics': 'one,two',
    })
  })

  it('prefers x-atproto-bsky-topics over the legacy topics header', () => {
    expect(
      getAtprotoPassthroughHeaders({
        headers: {
          'x-atproto-bsky-topics': 'new',
          'x-bsky-topics': 'legacy',
        },
      }),
    ).toEqual({
      'x-atproto-bsky-topics': 'new',
      'x-bsky-topics': 'legacy',
    })
  })
})
