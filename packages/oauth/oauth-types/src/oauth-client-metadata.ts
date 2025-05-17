import { z } from 'zod'
import { jwksPubSchema } from '@atproto/jwk'
import { oauthClientIdSchema } from './oauth-client-id.js'
import { oauthEndpointAuthMethod } from './oauth-endpoint-auth-method.js'
import { oauthGrantTypeSchema } from './oauth-grant-type.js'
import { oauthRedirectUriSchema } from './oauth-redirect-uri.js'
import { oauthResponseTypeSchema } from './oauth-response-type.js'
import { oauthScopeSchema } from './oauth-scope.js'
import { webUriSchema } from './uri.js'

/**
 * @see {@link https://openid.net/specs/openid-connect-registration-1_0.html}
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591}
 * @note we do not enforce https: scheme in URIs to support development
 * environments. Make sure to validate the URIs before using it in a production
 * environment.
 */
export const oauthClientMetadataSchema = z.object({
  /**
   * @note redirect_uris require additional validation
   */
  // https://www.rfc-editor.org/rfc/rfc7591.html#section-2
  redirect_uris: z.array(oauthRedirectUriSchema).nonempty(),
  response_types: z
    .array(oauthResponseTypeSchema)
    .nonempty()
    // > If omitted, the default is that the client will use only the "code"
    // > response type.
    .default(['code']),
  grant_types: z
    .array(oauthGrantTypeSchema)
    .nonempty()
    // > If omitted, the default behavior is that the client will use only the
    // > "authorization_code" Grant Type.
    .default(['authorization_code']),
  scope: oauthScopeSchema.optional(),
  // https://www.rfc-editor.org/rfc/rfc7591.html#section-2
  token_endpoint_auth_method: oauthEndpointAuthMethod
    // > If unspecified or omitted, the default is "client_secret_basic" [...].
    .default('client_secret_basic'),
  token_endpoint_auth_signing_alg: z.string().optional(),
  userinfo_signed_response_alg: z.string().optional(),
  userinfo_encrypted_response_alg: z.string().optional(),
  jwks_uri: webUriSchema.optional(),
  jwks: jwksPubSchema.optional(),
  application_type: z.enum(['web', 'native']).default('web'), // default, per spec, is "web"
  subject_type: z.enum(['public', 'pairwise']).default('public'),
  request_object_signing_alg: z.string().optional(),
  id_token_signed_response_alg: z.string().optional(),
  authorization_signed_response_alg: z.string().default('RS256'),
  authorization_encrypted_response_enc: z.enum(['A128CBC-HS256']).optional(),
  authorization_encrypted_response_alg: z.string().optional(),
  client_id: oauthClientIdSchema.optional(),
  client_name: z.string().optional(),
  client_uri: webUriSchema.optional(),
  policy_uri: webUriSchema.optional(),
  tos_uri: webUriSchema.optional(),
  logo_uri: webUriSchema.optional(), // @TODO: allow data: uri ?

  /**
   * Default Maximum Authentication Age. Specifies that the End-User MUST be
   * actively authenticated if the End-User was authenticated longer ago than
   * the specified number of seconds. The max_age request parameter overrides
   * this default value. If omitted, no default Maximum Authentication Age is
   * specified.
   */
  default_max_age: z.number().optional(),
  require_auth_time: z.boolean().optional(),
  contacts: z.array(z.string().email()).optional(),
  tls_client_certificate_bound_access_tokens: z.boolean().optional(),

  // https://datatracker.ietf.org/doc/html/rfc9449#section-5.2
  dpop_bound_access_tokens: z.boolean().optional(),

  // https://datatracker.ietf.org/doc/html/rfc9396#section-14.5
  authorization_details_types: z.array(z.string()).optional(),
})

export type OAuthClientMetadata = z.infer<typeof oauthClientMetadataSchema>
export type OAuthClientMetadataInput = z.input<typeof oauthClientMetadataSchema>
