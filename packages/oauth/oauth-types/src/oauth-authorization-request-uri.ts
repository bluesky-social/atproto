import { z } from 'zod'
import { oauthRequestUriSchema } from './oauth-request-uri.js'

export const oauthAuthorizationRequestUriSchema = z.object({
  request_uri: oauthRequestUriSchema,
})

export type OAuthAuthorizationRequestUri = z.infer<
  typeof oauthAuthorizationRequestUriSchema
>
