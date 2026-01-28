import { Router } from 'express'
import { AppContext } from '../../../../context'

export function statusQuickLogin(router: Router, ctx: AppContext) {
  router.post('/xrpc/io.trustanchor.quicklogin.status', async (req, res) => {
    try {
      if (!ctx.cfg.quicklogin) {
        return res.status(400).json({ error: 'QuickLogin not enabled' })
      }

      const { sessionId, sessionToken } = req.body

      if (!sessionId || !sessionToken) {
        return res
          .status(400)
          .json({ error: 'Missing sessionId or sessionToken' })
      }

      const session = ctx.quickloginStore.getSession(sessionId)
      if (!session || session.sessionToken !== sessionToken) {
        return res.status(404).json({ error: 'Invalid session' })
      }

      return res.json({
        status: session.status,
        result: session.result || undefined,
        error: session.error || undefined,
        expiresAt: session.expiresAt,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      req.log.error(
        { error: errorMessage, stack: errorStack },
        'QuickLogin status check failed',
      )
      return res.status(500).json({ error: 'Internal server error' })
    }
  })
}
