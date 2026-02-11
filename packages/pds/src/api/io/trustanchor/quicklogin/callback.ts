import express, { Router } from 'express'
import { AppContext } from '../../../../context'
import { handleQuickLoginCallback } from './callback-handler'
import { NeuroCallbackPayload } from './helpers'

export function callbackQuickLogin(router: Router, ctx: AppContext) {
  router.post('/api/quicklogin/callback', express.json(), async (req, res) => {
    try {
      if (!ctx.cfg.quicklogin) {
        return res.status(400).json({ error: 'QuickLogin not enabled' })
      }

      const payload = req.body as NeuroCallbackPayload

      // Call shared handler
      await handleQuickLoginCallback(payload, ctx, req.log)

      // Return success to provider
      return res.json({ success: true })
    } catch (error) {
      // Check for specific error codes
      const err = error as any
      if (err.code === 'InvitationRequired') {
        return res.status(403).json({
          error: 'InvitationRequired',
          message: err.message,
        })
      }

      // Handle known error messages
      if (err.message === 'Session not found') {
        return res.status(404).json({ error: err.message })
      }

      if (
        err.message === 'Missing Key' ||
        err.message === 'Session expired' ||
        err.message?.startsWith('QuickLogin ') ||
        err.message === 'JID missing from callback' ||
        err.message === 'Email required' ||
        err.message === 'Account not found'
      ) {
        return res.status(400).json({ error: err.message })
      }

      req.log.error(
        {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : error,
        },
        'QuickLogin callback failed',
      )
      return res.status(500).json({ error: 'Internal server error' })
    }
  })
}
