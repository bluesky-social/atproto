import { Keyset } from '@atproto/jwk'
import {
  OAuthAuthorizationServerMetadata,
  OAuthIssuerIdentifier,
  oauthAuthorizationServerMetadataValidator,
} from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { VERIFY_ALGOS } from '../lib/util/crypto.js'

export type CustomMetadata = {
  authorization_details_types_supported?: string[]
  protected_resources?: string[]
}

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8414#section-2}
 * @see {@link https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata}
 * @see {@link https://openid.net/specs/openid-connect-prompt-create-1_0.html}
 */
export function buildMetadata(
  issuer: OAuthIssuerIdentifier,
  keyset: Keyset,
  customMetadata?: CustomMetadata,
): OAuthAuthorizationServerMetadata {
  return oauthAuthorizationServerMetadataValidator.parse({
    issuer,

    scopes_supported: [
      'atproto',

      // These serve as hint that this server supports the transitional scopes.
      // This is not a specced behavior.
      'transition:email',
      'transition:generic',
      'transition:chat.bsky',

      // Other atproto scopes can't be enumerated as they are dynamic.
    ],
    subject_types_supported: [
      //
      'public', // The same "sub" is returned for all clients
      // 'pairwise', // A different "sub" is returned for each client
    ],
    response_types_supported: [
      // OAuth
      'code',
      // 'token',

      // OpenID
      // 'none',
      // 'code id_token token',
      // 'code id_token',
      // 'code token',
      // 'id_token token',
      // 'id_token',
    ],
    response_modes_supported: [
      // https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html#ResponseModes
      'query',
      'fragment',
      // https://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html#FormPostResponseMode
      'form_post',
    ],
    grant_types_supported: [
      //
      'authorization_code',
      'refresh_token',
    ],
    code_challenge_methods_supported: [
      // https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#pkce-code-challenge-method
      'S256',

      // atproto does not allow "plain"
      // 'plain',
    ],
    ui_locales_supported: [
      //
      'en-US',
    ],
    display_values_supported: [
      //
      'page',
      'popup',
      'touch',
      // 'wap', LoL
    ],

    // https://openid.net/specs/openid-connect-prompt-create-1_0.html
    prompt_values_supported: [
      'none',
      'login',
      'consent',
      'select_account',
      'create',
    ],

    // https://datatracker.ietf.org/doc/html/rfc9207
    authorization_response_iss_parameter_supported: true,

    // https://datatracker.ietf.org/doc/html/rfc9101#section-4
    request_object_signing_alg_values_supported: [...VERIFY_ALGOS, 'none'],
    request_object_encryption_alg_values_supported: [], // None
    request_object_encryption_enc_values_supported: [], // None

    request_parameter_supported: true,
    request_uri_parameter_supported: true,
    require_request_uri_registration: true,

    jwks_uri: new URL('/oauth/jwks', issuer).href,

    authorization_endpoint: new URL('/oauth/authorize', issuer).href,

    token_endpoint: new URL('/oauth/token', issuer).href,
    token_endpoint_auth_methods_supported: [...Client.AUTH_METHODS_SUPPORTED],
    token_endpoint_auth_signing_alg_values_supported: [...VERIFY_ALGOS],

    revocation_endpoint: new URL('/oauth/revoke', issuer).href,

    // @TODO Should we implement these endpoints?
    // introspection_endpoint: new URL('/oauth/introspect', issuer).href,
    // end_session_endpoint: new URL('/oauth/logout', issuer).href,

    // https://datatracker.ietf.org/doc/html/rfc9126#section-5
    pushed_authorization_request_endpoint: new URL('/oauth/par', issuer).href,

    require_pushed_authorization_requests: true,

    // https://datatracker.ietf.org/doc/html/rfc9449#section-5.1
    dpop_signing_alg_values_supported: [...VERIFY_ALGOS],

    // https://datatracker.ietf.org/doc/html/rfc9396#section-14.4
    authorization_details_types_supported:
      customMetadata?.authorization_details_types_supported,

    // https://www.rfc-editor.org/rfc/rfc9728.html#section-4
    protected_resources: customMetadata?.protected_resources,

    // https://www.ietf.org/archive/id/draft-ietf-oauth-client-id-metadata-document-00.html
    client_id_metadata_document_supported: true,
  })
}
