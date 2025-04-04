import { z } from 'zod'
import { oauthAuthorizationRequestJarSchema } from './oauth-authorization-request-jar.js'
import { oauthAuthorizationRequestParametersSchema } from './oauth-authorization-request-parameters.js'

export const oauthAuthorizationRequestParSchema = z.union([
  oauthAuthorizationRequestParametersSchema,
  oauthAuthorizationRequestJarSchema,
])

export type OAuthAuthorizationRequestPar = z.infer<
  typeof oauthAuthorizationRequestParSchema
>
