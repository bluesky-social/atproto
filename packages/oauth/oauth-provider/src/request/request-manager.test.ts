import { describe, expect, it } from 'vitest'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { narrowAuthorizedParameters } from './request-manager.js'

const params = (scope?: string): OAuthAuthorizationRequestParameters =>
  ({
    client_id: 'https://client.example/client-metadata.json',
    response_type: 'code',
    redirect_uri: 'https://client.example/cb',
    ...(scope == null ? {} : { scope }),
  }) as OAuthAuthorizationRequestParameters

describe('narrowAuthorizedParameters()', () => {
  it('keeps only the scopes the user approved', () => {
    expect(
      narrowAuthorizedParameters(
        params('atproto account:email transition:generic'),
        'atproto transition:generic',
      ),
    ).toEqual({
      ...params('atproto transition:generic'),
      scope: 'atproto transition:generic',
    })
  })

  it('cannot add scopes that were not requested', () => {
    expect(
      narrowAuthorizedParameters(params('atproto'), 'atproto account:email'),
    ).toEqual({ ...params('atproto'), scope: 'atproto' })
  })

  it('leaves the request untouched when nothing was approved', () => {
    const parameters = params('atproto account:email')
    expect(narrowAuthorizedParameters(parameters, undefined)).toBe(parameters)
  })

  it('requires the atproto scope', () => {
    expect(() =>
      narrowAuthorizedParameters(
        params('atproto account:email'),
        'account:email',
      ),
    ).toThrow(AccessDeniedError)
  })
})
