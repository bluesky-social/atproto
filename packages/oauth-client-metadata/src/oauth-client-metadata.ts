import { jwksPubSchema } from '@atproto-labs/jwk'
import { z } from 'zod'

import { oauthClientIdSchema } from './oauth-client-id.js'

export const endpointAuthMethod = z.enum([
  'client_secret_basic',
  'client_secret_jwt',
  'client_secret_post',
  'none',
  'private_key_jwt',
  'self_signed_tls_client_auth',
  'tls_client_auth',
])

export const oauthResponseTypeSchema = z.enum([
  // OAuth
  'code',
  'token',

  // OpenID
  'none',
  'code id_token token',
  'code id_token',
  'code token',
  'id_token token',
  'id_token',
])

export type OAuthResponseType = z.infer<typeof oauthResponseTypeSchema>

export const oauthGrantTypeSchema = z.enum([
  'authorization_code',
  'implicit',
  'refresh_token',
  'password', // Not part of OAuth 2.1
  'client_credentials',
  'urn:ietf:params:oauth:grant-type:jwt-bearer',
  'urn:ietf:params:oauth:grant-type:saml2-bearer',
])

export type OAuthGrantType = z.infer<typeof oauthGrantTypeSchema>

// https://openid.net/specs/openid-connect-registration-1_0.html
// https://datatracker.ietf.org/doc/html/rfc7591
export const oauthClientMetadataSchema = z
  .object({
    redirect_uris: z.array(z.string().url()).nonempty().readonly(),
    response_types: z
      .array(oauthResponseTypeSchema)
      .nonempty()
      // > If omitted, the default is that the client will use only the "code"
      // > response type.
      .default(['code'])
      .readonly(),
    grant_types: z
      .array(oauthGrantTypeSchema)
      .nonempty()
      // > If omitted, the default behavior is that the client will use only the
      // > "authorization_code" Grant Type.
      .default(['authorization_code'])
      .readonly(),
    scope: z.string().optional(),
    token_endpoint_auth_method: endpointAuthMethod.default('none').optional(),
    token_endpoint_auth_signing_alg: z.string().optional(),
    introspection_endpoint_auth_method: endpointAuthMethod.optional(),
    introspection_endpoint_auth_signing_alg: z.string().optional(),
    revocation_endpoint_auth_method: endpointAuthMethod.optional(),
    revocation_endpoint_auth_signing_alg: z.string().optional(),
    pushed_authorization_request_endpoint_auth_method:
      endpointAuthMethod.optional(),
    pushed_authorization_request_endpoint_auth_signing_alg: z
      .string()
      .optional(),
    userinfo_signed_response_alg: z.string().optional(),
    userinfo_encrypted_response_alg: z.string().optional(),
    jwks_uri: z.string().url().optional(),
    jwks: jwksPubSchema.optional(),
    application_type: z.enum(['web', 'native']).default('web').optional(), // default, per spec, is "web"
    subject_type: z.enum(['public', 'pairwise']).default('public').optional(),
    request_object_signing_alg: z.string().optional(),
    id_token_signed_response_alg: z.string().optional(),
    authorization_signed_response_alg: z.string().default('RS256').optional(),
    authorization_encrypted_response_enc: z.enum(['A128CBC-HS256']).optional(),
    authorization_encrypted_response_alg: z.string().optional(),
    client_id: oauthClientIdSchema.optional(),
    client_name: z.string().optional(),
    client_uri: z.string().url().optional(),
    policy_uri: z.string().url().optional(),
    tos_uri: z.string().url().optional(),
    logo_uri: z.string().url().optional(),
    default_max_age: z.number().optional(),
    require_auth_time: z.boolean().optional(),
    contacts: z.array(z.string().email()).readonly().optional(),
    tls_client_certificate_bound_access_tokens: z.boolean().optional(),

    // https://datatracker.ietf.org/doc/html/rfc9449#section-5.2
    dpop_bound_access_tokens: z.boolean().optional(),

    // https://datatracker.ietf.org/doc/html/rfc9396#section-14.5
    authorization_details_types: z.array(z.string()).readonly().optional(),
  })
  .readonly()

export type OAuthClientMetadata = z.infer<typeof oauthClientMetadataSchema>
