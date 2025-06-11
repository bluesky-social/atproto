import { Router } from 'express'
import { AppContext } from '../context'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  router.get('/.well-known/did.json', (_req, res) => {
    const hostname =
      ctx.cfg.service.publicUrl && new URL(ctx.cfg.service.publicUrl).hostname
    if (!hostname || ctx.cfg.service.did !== `did:web:${hostname}`) {
      return res.sendStatus(404)
    }
    res.json({
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ],
      id: ctx.cfg.service.did,
      verificationMethod: [
        {
          id: `${ctx.cfg.service.did}#atproto_label`,
          type: 'Multikey',
          controller: ctx.cfg.service.did,
          publicKeyMultibase: ctx.signingKey.did().replace('did:key:', ''),
        },
      ],
      service: [
        {
          id: '#atproto_labeler',
          type: 'AtprotoLabeler',
          serviceEndpoint: `https://${hostname}`,
        },
      ],
    })
  })

  router.get('/.well-known/ozone-metadata.json', (_req, res) => {
    return res.json({
      did: ctx.cfg.service.did,
      url: ctx.cfg.service.publicUrl,
      publicKey: ctx.signingKey.did(),
    })
  })

  return router
}
