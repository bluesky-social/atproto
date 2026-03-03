import express, { Router } from 'express'
import { AppContext } from '../../../../context'

export function statusQuickLogin(router: Router, ctx: AppContext) {
  router.post('/api/quicklogin/status', express.json(), async (req, res) => {
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

      const statusResponse = {
        status: session.status,
        result: session.result || undefined,
        error: session.error || undefined,
        expiresAt: session.expiresAt,
      }

      if (ctx.cfg.debugNeuro && session.status === 'completed') {
        req.log.info(
          {
            sessionId,
            statusResponse,
            callbackPayload: session.debugNeuro?.callbackPayload,
            callbackFieldNames: session.debugNeuro?.receivedFieldNames,
            unexpectedFieldNames: session.debugNeuro?.unexpectedFieldNames,
          },
          'QuickLogin status completed response (debug)',
        )
      }

      return res.json(statusResponse)
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
