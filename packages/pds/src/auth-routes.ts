import { oauthProtectedResourceMetadataSchema } from '@atproto/oauth-provider'
import { Router } from 'express'

import AppContext from './context'

export const createRouter = ({ authProvider, cfg }: AppContext): Router => {
  const router = Router()

  const oauthProtectedResourceMetadata =
    oauthProtectedResourceMetadataSchema.parse({
      resource: cfg.service.publicUrl,
      authorization_servers: [cfg.entryway?.url ?? cfg.service.publicUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: ['profile', 'email', 'phone'],
      resource_documentation: 'https://atproto.com',
    })

  router.get('/.well-known/oauth-protected-resource', (req, res) => {
    res.status(200).json(oauthProtectedResourceMetadata)
  })

  if (authProvider) {
    router.use(authProvider.createRouter())
  }

  return router
}
