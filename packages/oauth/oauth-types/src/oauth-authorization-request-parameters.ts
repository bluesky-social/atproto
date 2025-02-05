import { z } from 'zod'
import { signedJwtSchema } from '@atproto/jwk'
import { oauthAuthorizationDetailsSchema } from './oauth-authorization-details.js'
import { oauthClientIdSchema } from './oauth-client-id.js'
import { oauthCodeChallengeMethodSchema } from './oauth-code-challenge-method.js'
import { oauthRedirectUriSchema } from './oauth-redirect-uri.js'
import { oauthResponseTypeSchema } from './oauth-response-type.js'
import { oauthScopeSchema } from './oauth-scope.js'
import { oidcClaimsParameterSchema } from './oidc-claims-parameter.js'
import { oidcClaimsPropertiesSchema } from './oidc-claims-properties.js'
import { oidcEntityTypeSchema } from './oidc-entity-type.js'

/**
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest | OIDC}
 */
export const oauthAuthorizationRequestParametersSchema = z.object({
  client_id: oauthClientIdSchema,
  state: z.string().optional(),
  redirect_uri: oauthRedirectUriSchema.optional(),
  scope: oauthScopeSchema.optional(),
  response_type: oauthResponseTypeSchema,

  // PKCE

  code_challenge: z.string().optional(),
  code_challenge_method: oauthCodeChallengeMethodSchema
    .default('S256')
    .optional(),

  // DPOP

  // https://datatracker.ietf.org/doc/html/rfc9449#section-12.3
  dpop_jkt: z.string().optional(),

  // OIDC

  // Default depend on response_type
  response_mode: z.enum(['query', 'fragment', 'form_post']).optional(),

  nonce: z.string().optional(),

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
      oidcEntityTypeSchema,
      z.record(
        oidcClaimsParameterSchema,
        z.union([z.literal(null), oidcClaimsPropertiesSchema]),
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
  id_token_hint: signedJwtSchema.optional(),

  // Type of UI the AS is displayed on
  display: z.enum(['page', 'popup', 'touch', 'wap']).optional(),

  /**
   * - "none" will only be allowed if the user already allowed the client on the same device
   * - "login" will force the user to login again, unless he very recently logged in
   * - "consent" will force the user to consent again
   * - "select_account" will force the user to select an account
   */
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),

  // https://datatracker.ietf.org/doc/html/rfc9396
  authorization_details: oauthAuthorizationDetailsSchema.optional(),
})

/**
 * @see {oauthAuthorizationRequestParametersSchema}
 */
export type OAuthAuthorizationRequestParameters = z.infer<
  typeof oauthAuthorizationRequestParametersSchema
>
