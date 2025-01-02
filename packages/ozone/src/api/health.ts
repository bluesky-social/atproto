import express from 'express'
import { sql } from 'kysely'
import AppContext from '../context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/robots.txt', function (req, res) {
    res.type('text/plain')
    res.send(
      '# Hello Friends!\n\n# Crawling the public parts of the API is allowed. HTTP 429 ("backoff") status codes are used for rate-limiting. Up to a handful concurrent requests should be ok.\nUser-agent: *\nAllow: /',
    )
  })

  router.get('/xrpc/_health', async function (req, res) {
    const { version } = ctx.cfg.service
    try {
      await sql`select 1`.execute(ctx.db.db)
    } catch (err) {
      req.log.error(err, 'failed health check')
      return res.status(503).send({ version, error: 'Service Unavailable' })
    }
    res.send({ version })
  })

  return router
}
