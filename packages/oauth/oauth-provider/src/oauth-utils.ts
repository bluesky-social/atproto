import type { z } from 'zod'
import { oauthProtectedResourceMetadataSchema } from '@atproto/oauth-types'

export function buildProtectedResourceMetadata(
  value: z.input<typeof oauthProtectedResourceMetadataSchema>,
) {
  return oauthProtectedResourceMetadataSchema.parse(value)
}
