import { z } from 'zod'

export const oauthResponseTypeSchema = z.enum([
  // OAuth2 (https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-4.1.1)
  'code', // Authorization Code Grant
  'token', // Implicit Grant

  // OIDC (https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
  'none',
  'code id_token token',
  'code id_token',
  'code token',
  'id_token token',
  'id_token',
])

export type OAuthResponseType = z.infer<typeof oauthResponseTypeSchema>
