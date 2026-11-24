import { z } from 'zod'
import { oauthAuthorizationRequestJarSchema } from './oauth-authorization-request-jar.js'
import { oauthAuthorizationRequestParametersSchema } from './oauth-authorization-request-parameters.js'
import { oauthAuthorizationRequestUriSchema } from './oauth-authorization-request-uri.js'
import { oauthClientIdSchema } from './oauth-client-id.js'

export const oauthAuthorizationRequestQuerySchema = z.intersection(
  z.object({
    // REQUIRED. OAuth 2.0 [RFC6749] client_id.
    client_id: oauthClientIdSchema,
  }),
  z.union([
    // @NOTE a query should only ever match one of the three types: URI, JAR, or
    // parameters
    oauthAuthorizationRequestUriSchema.extend({
      request: z.never().optional(),
    }),
    oauthAuthorizationRequestJarSchema.extend({
      request_uri: z.never().optional(),
    }),
    oauthAuthorizationRequestParametersSchema.extend({
      request_uri: z.never().optional(),
      request: z.never().optional(),
    }),
  ]),
)

export type OAuthAuthorizationRequestQuery = z.infer<
  typeof oauthAuthorizationRequestQuerySchema
>
