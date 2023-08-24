import express from 'express'
import AppContext from '../context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/.well-known/did.json', (_req, res) => {
    const hostname = ctx.cfg.publicUrl && new URL(ctx.cfg.publicUrl).hostname
    if (!hostname || ctx.cfg.serverDid !== `did:web:${hostname}`) {
      return res.sendStatus(404)
    }
    res.json({
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: ctx.cfg.serverDid,
      service: [
        {
          id: '#bsky_notif',
          type: 'BskyNotificationService',
          serviceEndpoint: `https://${hostname}`,
        },
      ],
    })
  })

  return router
}
