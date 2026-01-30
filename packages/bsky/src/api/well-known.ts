import { Router } from 'express'
import { didWebToUrl, isDidWeb } from '@atproto/did'
import { AppContext } from '../context'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  const did = ctx.cfg.serverDid
  if (isDidWeb(did)) {
    const serviceEndpoint = didWebToUrl(did).origin

    router.get('/.well-known/did.json', (_req, res) => {
      res.json({
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/multikey/v1',
        ],
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
