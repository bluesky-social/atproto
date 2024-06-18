import { z } from 'zod'

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
