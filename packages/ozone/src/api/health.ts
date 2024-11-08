import express from 'express'
import { sql } from 'kysely'
import AppContext from '../context'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/', function (req, res) {
    res.type('text/plain')
    res.send(`
    ,o888888o.   8888888888',8888'  ,o888888o.     b.             8 8 8888888888
 . 8888     '88.        ,8',8888'. 8888     '88.   888o.          8 8 8888
,8 8888       '8b      ,8',8888',8 8888       '8b  Y88888o.       8 8 8888
88 8888        '8b    ,8',8888' 88 8888        '8b .'Y888888o.    8 8 8888
88 8888         88   ,8',8888'  88 8888         88 8o. 'Y888888o. 8 8 888888888888
88 8888         88  ,8',8888'   88 8888         88 8'Y8o. 'Y88888o8 8 8888
88 8888        ,8P ,8',8888'    88 8888        ,8P 8   'Y8o. 'Y8888 8 8888
'8 8888       ,8P ,8',8888'     '8 8888       ,8P  8      'Y8o. 'Y8 8 8888
 ' 8888     ,88' ,8',8888'       ' 8888     ,88'   8         'Y8o.' 8 8888
    '8888888P'  ,8',8888888888888   '8888888P'     8            'Yo 8 888888888888


This is an AT Protocol Moderation Service API Server.

Most API routes are under /xrpc/

      Code: https://github.com/bluesky-social/atproto
 Self-Host: https://github.com/bluesky-social/ozone
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
