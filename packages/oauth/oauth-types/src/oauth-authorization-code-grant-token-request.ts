import { z } from 'zod'
import { oauthRedirectUriSchema } from './oauth-redirect-uri.js'

export const oauthAuthorizationCodeGrantTokenRequestSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  redirect_uri: oauthRedirectUriSchema,
  /** @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.1} */
  code_verifier: z
    .string()
    .min(43)
    .max(128)
    .regex(/^[a-zA-Z0-9-._~]+$/)
    .optional(),
})

export type OAuthAuthorizationCodeGrantTokenRequest = z.infer<
  typeof oauthAuthorizationCodeGrantTokenRequestSchema
>
