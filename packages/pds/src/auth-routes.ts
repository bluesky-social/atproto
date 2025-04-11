import { Router } from 'express'
import {
  oauthMiddleware,
  oauthProtectedResourceMetadataSchema,
} from '@atproto/oauth-provider'
import { AppContext } from './context'
import { oauthLogger } from './logger'

export const createRouter = ({ oauthProvider, cfg }: AppContext): Router => {
  const router = Router()

  const oauthProtectedResourceMetadata =
    oauthProtectedResourceMetadataSchema.parse({
      resource: cfg.service.publicUrl,
      authorization_servers: [cfg.entryway?.url ?? cfg.service.publicUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: [],
      resource_documentation: 'https://atproto.com',
    })

  if (
    !cfg.service.devMode &&
    !oauthProtectedResourceMetadata.resource.startsWith('https://')
  ) {
    throw new Error('Resource URL must use the https scheme')
  }

  router.get('/.well-known/oauth-protected-resource', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Method', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.status(200).json(oauthProtectedResourceMetadata)
  })

  if (oauthProvider) {
    router.use(
      oauthMiddleware(oauthProvider, {
        onError: (req, res, err, message) => {
          oauthLogger.error({ err, req }, message)
        },
      }),
    )
  }

  return router
}
