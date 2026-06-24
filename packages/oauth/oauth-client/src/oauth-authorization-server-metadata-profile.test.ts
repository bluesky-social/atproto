import { oauthAuthorizationServerMetadataValidator } from '@atproto/oauth-types'
import { describe, expect, it } from 'vitest'

describe('ATProto authorization server metadata profile', () => {
  it('accepts metadata without OIDC-only and broad algorithm declarations', () => {
    const issuer = 'https://auth.example'
    const metadata = oauthAuthorizationServerMetadataValidator.parse({
      issuer,
      scopes_supported: ['atproto'],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      request_object_signing_alg_values_supported: ['ES256', 'none'],
      request_parameter_supported: true,
      request_uri_parameter_supported: true,
      require_request_uri_registration: true,
      jwks_uri: `${issuer}/oauth/jwks`,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
      token_endpoint_auth_signing_alg_values_supported: ['ES256'],
      revocation_endpoint: `${issuer}/oauth/revoke`,
      pushed_authorization_request_endpoint: `${issuer}/oauth/par`,
      require_pushed_authorization_requests: true,
      dpop_signing_alg_values_supported: ['ES256'],
      client_id_metadata_document_supported: true,
      prompt_values_supported: ['none', 'login', 'consent', 'select_account'],
    })

    expect(metadata.subject_types_supported).toBeUndefined()
    expect(metadata.response_modes_supported).toEqual(['query'])
    expect(metadata.token_endpoint_auth_signing_alg_values_supported).toEqual([
      'ES256',
    ])
    expect(metadata.dpop_signing_alg_values_supported).toEqual(['ES256'])
  })
})
