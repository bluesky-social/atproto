import { describe, expect, it } from 'vitest'
import { isValidUri } from '../src/index.js'

describe('isValidUri', () => {
  it.each([
    'https://example.com/path',
    'at://did:plc:xyz/app.bsky.feed.post/abc',
    'web+ap://example.com/u/alice',
    'git+https://github.com/a/b.git',
    'content-type:text/plan',
    'microsoft.windows.camera:thing',
    'did:plc:xyz',
  ])('accepts %s', (uri) => {
    expect(isValidUri(uri)).toBe(true)
  })

  it.each([
    'a_b:c', // underscore is not allowed in schemes
    '1abc:x', // schemes must start with a letter
    '-abc:x',
    '.abc:x',
    '+abc:x',
    'not a uri',
    '',
    'http://',
    'foo bar:baz',
  ])('rejects %s', (uri) => {
    expect(isValidUri(uri)).toBe(false)
  })
})
