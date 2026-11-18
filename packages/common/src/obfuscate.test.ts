import { describe, expect, it } from 'vitest'
import { obfuscateHeaders, obfuscateResSerializer } from './obfuscate.js'

describe(obfuscateHeaders, () => {
  it('redacts cookies case-insensitively without modifying the input', () => {
    const headers = {
      Cookie: 'session=secret',
      'Set-Cookie': ['session=secret; HttpOnly', 'csrf=secret'],
      accept: 'application/json',
      'content-length': 42,
    }
    expect(obfuscateHeaders(headers)).toEqual({
      Cookie: '[Redacted]',
      'Set-Cookie': '[Redacted]',
      accept: 'application/json',
      'content-length': 42,
    })
    expect(headers.Cookie).toBe('session=secret')
    expect(headers['Set-Cookie']).toHaveLength(2)
  })

  it('preserves existing authorization and DPoP obfuscation', () => {
    expect(
      obfuscateHeaders({
        Authorization: 'Bearer some-long-secret',
        DPoP: 'not-a-jwt',
        accept: '*/*',
      }),
    ).toEqual({
      Authorization: 'Bearer s***t',
      DPoP: 'Invalid',
      accept: '*/*',
    })
  })

  it('does not throw or expose unexpected non-string credentials', () => {
    expect(
      obfuscateHeaders({ authorization: ['secret'], dpop: undefined }),
    ).toEqual({ authorization: 'Invalid', dpop: 'Invalid' })
  })
})

describe(obfuscateResSerializer, () => {
  it('redacts response cookies and preserves the status and other headers', () => {
    expect(
      obfuscateResSerializer({
        statusCode: 201,
        headers: {
          'set-cookie': ['session=secret; HttpOnly'],
          'content-length': 42,
        },
      }),
    ).toEqual({
      statusCode: 201,
      headers: { 'set-cookie': '[Redacted]', 'content-length': 42 },
    })
  })

  it('preserves an unavailable status and missing headers', () => {
    expect(obfuscateResSerializer({})).toEqual({
      statusCode: null,
      headers: undefined,
    })
  })
})
