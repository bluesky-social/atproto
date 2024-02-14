import { jwksPubSchema } from '@atproto/jwk'
import { z } from 'zod'

import { VERIFY_ALGOS } from '../util/crypto.js'
import { clientIdSchema } from './client-id.js'

export const endpointAuthMethod = z.enum([
  'client_secret_basic',
  'client_secret_jwt',
  'client_secret_post',
  'none',
  'private_key_jwt',
  'self_signed_tls_client_auth',
  'tls_client_auth',
])

export const algSchema = z.enum(VERIFY_ALGOS)

// TODO: Move in shared package
// https://openid.net/specs/openid-connect-registration-1_0.html
// https://datatracker.ietf.org/doc/html/rfc7591
export const clientMetadataSchema = z
  .object({
    redirect_uris: z.array(z.string().url()).nonempty().readonly(),
    response_types: z
      .array(
        z.enum([
          // OAuth
          'code',
          'token',

          // OpenID
          'none',
          'id_token',
          'code id_token',
          'id_token token',
          'code token',
          'code id_token token',
        ]),
      )
      .nonempty()
      .default(['code'])
      .readonly(),
    grant_types: z
      .array(
        z.enum([
          'authorization_code',
          'implicit',
          'refresh_token',
          'password',
          'client_credentials',
          'urn:ietf:params:oauth:grant-type:jwt-bearer',
          'urn:ietf:params:oauth:grant-type:saml2-bearer',
        ]),
      )
      .nonempty()
      // "If omitted, the default behavior is that the client will use only the
      // "authorization_code" Grant Type." [RFC7591]
      .default(['authorization_code'])
      .readonly(),
    scope: z.string().optional(),
    token_endpoint_auth_method: endpointAuthMethod.default('none'),
    token_endpoint_auth_signing_alg: algSchema.optional(),
    introspection_endpoint_auth_method: endpointAuthMethod.optional(),
    introspection_endpoint_auth_signing_alg: algSchema.optional(),
    revocation_endpoint_auth_method: endpointAuthMethod.optional(),
    revocation_endpoint_auth_signing_alg: algSchema.optional(),
    userinfo_signed_response_alg: algSchema.optional(),
    userinfo_encrypted_response_alg: z.string().optional(),
    jwks_uri: z.string().url().optional(),
    jwks: jwksPubSchema.optional(),
    application_type: z.enum(['web', 'native']).default('web'), // default, per spec, is "web"
    subject_type: z.enum(['public', 'pairwise']).default('public'),
    request_object_signing_alg: z
      .union([algSchema, z.literal('none')])
      .optional(),
    id_token_signed_response_alg: algSchema.optional(),
    authorization_signed_response_alg: algSchema.default('RS256').optional(),
    authorization_encrypted_response_enc: z.enum(['A128CBC-HS256']).optional(),
    authorization_encrypted_response_alg: algSchema.optional(),
    client_id: clientIdSchema.optional(),
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
  .brand('ClientMetadata')

export type ClientMetadata = z.infer<typeof clientMetadataSchema>
