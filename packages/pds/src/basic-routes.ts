import express from 'express'
import { sql } from 'kysely'
import AppContext from './context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/', function (req, res) {
    res.type('text/plain')
    res.send(
      'This is an AT Protocol Personal Data Server (PDS): https://github.com/bluesky-social/atproto\n\nMost API routes are under /xrpc/',
    )
  })

  router.get('/robots.txt', function (req, res) {
    res.type('text/plain')
    res.send(
      '# Hello!\n\n# Crawling the public API is allowed\nUser-agent: *\nAllow: /',
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
