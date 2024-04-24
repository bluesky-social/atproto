import { z } from 'zod'

import { oauthClientIdSchema } from './oauth-client-id.js'
import { oauthClientCredentialsSchema } from './oauth-client-credentials.js'

export const oauthClientIdentificationSchema = z.union([
  oauthClientCredentialsSchema,
  // Must be last since it is less specific
  z.object({ client_id: oauthClientIdSchema }),
])

export type OAuthClientIdentification = z.infer<
  typeof oauthClientIdentificationSchema
>
