import { Router } from 'express'
import express from 'express'
import { sql } from 'kysely'
import { AppContext } from './context'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  router.get('/', function (req, res) {
    res.type('text/plain')
    res.send(`
         __                         __
        /\\ \\__                     /\\ \\__
    __  \\ \\ ,_\\  _____   _ __   ___\\ \\ ,_\\   ___
  /'__'\\ \\ \\ \\/ /\\ '__'\\/\\''__\\/ __'\\ \\ \\/  / __'\\
 /\\ \\L\\.\\_\\ \\ \\_\\ \\ \\L\\ \\ \\ \\//\\ \\L\\ \\ \\ \\_/\\ \\L\\ \\
 \\ \\__/.\\_\\\\ \\__\\\\ \\ ,__/\\ \\_\\\\ \\____/\\ \\__\\ \\____/
  \\/__/\\/_/ \\/__/ \\ \\ \\/  \\/_/ \\/___/  \\/__/\\/___/
                   \\ \\_\\
                    \\/_/


This is an AT Protocol Personal Data Server (aka, an atproto PDS)

Most API routes are under /xrpc/

      Code: https://github.com/bluesky-social/atproto
 Self-Host: https://github.com/bluesky-social/pds
  Protocol: https://atproto.com
`)
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
      await sql`select 1`.execute(ctx.accountManager.db.db)
    } catch (err) {
      req.log.error({ err }, 'failed health check')
      res.status(503).send({ version, error: 'Service Unavailable' })
      return
    }
    res.send({ version })
  })

  // Add JSON body parser for Neuro routes
  router.use('/neuro/*', express.json())

  // Neuro Quick Login callback endpoint
  if (ctx.neuroAuthManager) {
    router.post('/neuro/callback', async function (req, res) {
      try {
        const { sessionId, jid, userName, email, eMail, ...otherFields } =
          req.body

        // Validate required fields
        if (!sessionId || !jid) {
          req.log.warn({ body: req.body }, 'Neuro callback missing fields')
          return res.status(400).json({
            error: 'Missing required fields',
            code: 'NEURO_CALLBACK_MISSING_FIELDS',
            details: 'sessionId and jid are required',
          })
        }

        // Basic JID validation
        if (!jid.includes('@')) {
          req.log.warn({ jid }, 'Invalid JID format in Neuro callback')
          return res.status(400).json({
            error: 'Invalid JID format',
            code: 'NEURO_CALLBACK_INVALID_JID',
            details: 'JID must contain @',
          })
        }

        // Process callback
        if (!ctx.neuroAuthManager) {
          return res.status(503).json({
            success: false,
            code: 'NEURO_NOT_CONFIGURED',
            message: 'Neuro authentication not configured',
          })
        }

        ctx.neuroAuthManager.handleCallback({
          sessionId,
          jid,
          userName,
          email,
          eMail,
          ...otherFields,
        })

        req.log.info(
          {
            sessionId: sessionId.substring(0, 8) + '...',
            hasEmail: !!(email || eMail),
          },
          'Neuro callback received',
        )

        res.status(200).json({ success: true })
      } catch (err) {
        req.log.error({ err }, 'Neuro callback error')
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Internal server error',
          code: 'NEURO_CALLBACK_ERROR',
        })
      }
    })

    // Session status endpoint for frontend polling (optional)
    router.get('/neuro/session/:sessionId/status', async function (req, res) {
      const { sessionId } = req.params
      const isPending = ctx.neuroAuthManager?.isSessionPending(sessionId)
      const isCompleted = ctx.neuroAuthManager?.isSessionCompleted(sessionId)

      res.json({
        pending: isPending,
        completed: isCompleted,
      })
    })
  }

  return router
}
