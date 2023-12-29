import express from 'express'
import AppContext from '../context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/xrpc/_health', async function (req, res) {
    const { version } = ctx.cfg
    try {
      await ctx.dataplane.ping({})
    } catch (err) {
      req.log.error(err, 'failed health check')
      return res.status(503).send({ version, error: 'Service Unavailable' })
    }
    res.send({ version })
  })

  return router
}
