import { z } from 'zod'
import { jwtSchema } from '@atproto/jwk'

import { authorizationDetailsSchema } from '../parameters/authorization-details.js'

// Matches the claims_supported from the authorization server metadata
export const entityClaimsSchema = z.enum([
  // https://openid.net/specs/openid-provider-authentication-policy-extension-1_0.html#rfc.section.5.2
  // if client metadata "require_auth_time" is true, this *must* be provided
  'auth_time',

  // OIDC
  'nonce',
  'acr',

  // OpenID: "profile" scope
  'name',
  'family_name',
  'given_name',
  'middle_name',
  'nickname',
  'preferred_username',
  'gender',
  'picture',
  'profile',
  'website',
  'birthdate',
  'zoneinfo',
  'locale',
  'updated_at',

  // OpenID: "email" scope
  'email',
  'email_verified',

  // OpenID: "phone" scope
  'phone_number',
  'phone_number_verified',

  // OpenID: "address" scope
  'address',
])

export type EntityClaims = z.infer<typeof entityClaimsSchema>

export const claimsEntityTypeSchema = z.enum(['userinfo', 'id_token'])

export type ClaimsEntityType = z.infer<typeof claimsEntityTypeSchema>

const claimValueSchema = z.union([z.string(), z.number(), z.boolean()])
export const claimsParameterMemberSchema = z.object({
  essential: z.boolean().optional(),
  value: claimValueSchema.optional(),
  values: z.array(claimValueSchema).optional(),
})

export type ClaimsParameterMember = z.infer<typeof claimsParameterMemberSchema>

// https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
export const authorizationParametersSchema = z.object({
  // Will be added by other schemas
  // client_id: clientIdSchema,

  state: z.string().optional(),
  nonce: z.string().optional(),
  dpop_jkt: z.string().optional(),

  response_type: z.enum([
    // OAuth2 (https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-4.1.1)
    'code',
    'token',

    // OIDC (https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
    'id_token',
    'none',
    'code token',
    'code id_token',
    'id_token token',
    'code id_token token',
  ]),

  // Default depend on response_type
  response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),

  // PKCE
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['S256', 'plain']).default('S256').optional(),

  redirect_uri: z.string().url().optional(),

  // email profile openid (other?)
  scope: z
    .string()
    .regex(/^[a-zA-Z0-9_]+( [a-zA-Z0-9_]+)*$/)
    .optional(),

  // OIDC

  // Specifies the allowable elapsed time in seconds since the last time the
  // End-User was actively authenticated by the OP. If the elapsed time is
  // greater than this value, the OP MUST attempt to actively re-authenticate
  // the End-User. (The max_age request parameter corresponds to the OpenID 2.0
  // PAPE [OpenID.PAPE] max_auth_age request parameter.) When max_age is used,
  // the ID Token returned MUST include an auth_time Claim Value. Note that
  // max_age=0 is equivalent to prompt=login.
  max_age: z.number().int().min(0).optional(),

  claims: z
    .record(
      claimsEntityTypeSchema,
      z.record(
        entityClaimsSchema,
        z.union([z.literal(null), claimsParameterMemberSchema]),
      ),
    )
    .optional(),

  // https://openid.net/specs/openid-connect-core-1_0.html#RegistrationParameter
  // Not supported by this library (yet?)
  // registration: clientMetadataSchema.optional(),

  login_hint: z.string().min(1).optional(),

  ui_locales: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?( [a-z]{2}(-[A-Z]{2})?)*$/) // fr-CA fr en
    .optional(),

  // Previous ID Token, should be provided when prompt=none is used
  id_token_hint: jwtSchema.optional(),

  // Type of UI the AS is displayed on
  display: z.enum(['page', 'popup', 'touch']).optional(),

  /**
   * - "none" will only be allowed if the user already allowed the client on the same device
   * - "login" will force the user to login again, unless he very recently logged in
   * - "consent" will force the user to consent again
   * - "select_account" will force the user to select an account
   */
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),

  // https://datatracker.ietf.org/doc/html/rfc9396
  authorization_details: authorizationDetailsSchema.optional(),
})

export type AuthorizationParameters = z.infer<
  typeof authorizationParametersSchema
>
