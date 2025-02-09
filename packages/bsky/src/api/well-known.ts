import { Router } from 'express'
import { AppContext } from '../context'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  const did = ctx.cfg.serverDid
  if (did.startsWith('did:web:')) {
    const hostname = did.slice('did:web:'.length)
    const serviceEndpoint = `https://${hostname}`

    router.get('/.well-known/did.json', (_req, res) => {
      res.json({
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [
          {
            id: `${did}#atproto`,
            type: 'Multikey',
            controller: did,
            publicKeyMultibase: ctx.signingKey.did().replace('did:key:', ''),
          },
        ],
        service: [
          {
            id: '#bsky_notif',
            type: 'BskyNotificationService',
            serviceEndpoint,
          },
          {
            id: '#bsky_appview',
            type: 'BskyAppView',
            serviceEndpoint,
          },
        ],
      })
    })
  }

  return router
}
