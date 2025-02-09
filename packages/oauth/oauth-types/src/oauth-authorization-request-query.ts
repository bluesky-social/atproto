import { z } from 'zod'
import { oauthAuthorizationRequestJarSchema } from './oauth-authorization-request-jar.js'
import { oauthAuthorizationRequestParametersSchema } from './oauth-authorization-request-parameters.js'
import { oauthAuthorizationRequestUriSchema } from './oauth-authorization-request-uri.js'

export const oauthAuthorizationRequestQuerySchema = z.union([
  oauthAuthorizationRequestParametersSchema,
  oauthAuthorizationRequestJarSchema,
  oauthAuthorizationRequestUriSchema,
])

export type OAuthAuthorizationRequestQuery = z.infer<
  typeof oauthAuthorizationRequestQuerySchema
>
