import { z } from 'zod'

export const oauthResponseTypeSchema = z.enum([
  // OAuth
  'code', // Authorization Code Grant
  'token', // Implicit Grant

  // OpenID
  'none',
  'code id_token token',
  'code id_token',
  'code token',
  'id_token token',
  'id_token',
])

export type OAuthResponseType = z.infer<typeof oauthResponseTypeSchema>
