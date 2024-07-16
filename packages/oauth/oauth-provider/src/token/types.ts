import {
  OAuthAuthorizationDetails,
  OAuthTokenType,
  accessTokenSchema,
  oauthClientIdentificationSchema,
} from '@atproto/oauth-types'
import { z } from 'zod'

import { clientIdSchema } from '../client/client-id.js'
import { codeSchema } from '../request/code.js'
import { refreshTokenSchema } from './refresh-token.js'

export const codeGrantRequestSchema = z.intersection(
  oauthClientIdentificationSchema,
  z.object({
    grant_type: z.literal('authorization_code'),
    code: codeSchema,
    /** @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.1} */
    code_verifier: z
      .string()
      .min(43)
      .max(128)
      .regex(/^[a-zA-Z0-9-._~]+$/),
    redirect_uri: z.string().url(),
    // request_uri ???
  }),
)

export type CodeGrantRequest = z.infer<typeof codeGrantRequestSchema>

export const refreshGrantRequestSchema = z.intersection(
  oauthClientIdentificationSchema,
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: refreshTokenSchema,
    client_id: clientIdSchema,
  }),
)

export type RefreshGrantRequest = z.infer<typeof refreshGrantRequestSchema>

export const tokenRequestSchema = z.union([
  codeGrantRequestSchema,
  refreshGrantRequestSchema,
])

export type TokenRequest = z.infer<typeof tokenRequestSchema>

export const tokenIdentification = z.object({
  token: z.union([accessTokenSchema, refreshTokenSchema]),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
})

export type TokenIdentification = z.infer<typeof tokenIdentification>

export const revokeSchema = tokenIdentification

export type Revoke = z.infer<typeof revokeSchema>

export const introspectSchema = z.intersection(
  oauthClientIdentificationSchema,
  tokenIdentification,
)

export type Introspect = z.infer<typeof introspectSchema>

// https://datatracker.ietf.org/doc/html/rfc7662#section-2.2
export type IntrospectionResponse =
  | { active: false }
  | {
      active: true

      scope?: string
      client_id?: string
      username?: string
      token_type?: OAuthTokenType
      authorization_details?: OAuthAuthorizationDetails

      aud?: string | [string, ...string[]]
      exp?: number
      iat?: number
      iss?: string
      jti?: string
      nbf?: number
      sub?: string
    }
