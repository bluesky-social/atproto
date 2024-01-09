import express from 'express'
import AppContext from '../context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/.well-known/did.json', (_req, res) => {
    const hostname =
      ctx.cfg.service.publicUrl && new URL(ctx.cfg.service.publicUrl).hostname
    if (!hostname || ctx.cfg.service.did !== `did:web:${hostname}`) {
      return res.sendStatus(404)
    }
    res.json({
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: ctx.cfg.service.did,
      verificationMethod: [
        {
          id: `${ctx.cfg.service.did}#atproto`,
          type: 'Multikey',
          controller: ctx.cfg.service.did,
          publicKeyMultibase: ctx.signingKey.did().replace('did:key:', ''),
        },
      ],
      service: [
        {
          id: '#atproto_mod',
          type: 'AtprotoModerationService',
          serviceEndpoint: `https://${hostname}`,
        },
      ],
    })
  })

  return router
}
