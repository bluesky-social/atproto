import { Router } from 'express'
import { AppContext } from '../context'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  router.get('/', function (req, res) {
    res.type('text/plain')
    res.send(`
  _         _
 | |       | |
 | |__  ___| | ___   _
 | '_ \\/ __| |/ / | | |
 | |_) \\__ \\   <| |_| |
 |_.__/|___/_|\\_\\\\__, |
                  __/ |
                 |___/

This is an AT Protocol Application View (AppView) for the "bsky.app" application.

Most API routes are under /xrpc/

      Code: https://github.com/bluesky-social/atproto
  Protocol: https://atproto.com
`)
  })

  router.get('/robots.txt', function (req, res) {
    res.type('text/plain')
    res.send(
      '# Hello Friends!\n\n# Crawling the public parts of the API is allowed. HTTP 429 ("backoff") status codes are used for rate-limiting. Up to a handful concurrent requests should be ok.\nUser-agent: *\nAllow: /',
    )
  })

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
