import { Router } from 'express'
import { AppContext } from '../context'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  router.get('/xrpc/_health', async function (req, res) {
    try {
      await ctx.dataplane.ping({})
    } catch (err) {
      req.log.error({ err }, 'failed health check')
      return res.status(503).send({ error: 'Service Unavailable' })
    }
    res.send({ ok: true })
  })

  return router
}
