import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { handleQuickLoginCallback } from './callback-handler'
import { NeuroCallbackPayload } from './helpers'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.quicklogin.callback({
    handler: async ({ input, req }) => {
      if (!ctx.cfg.quicklogin) {
        throw new InvalidRequestError('QuickLogin not enabled')
      }

      const payload = input.body as NeuroCallbackPayload
      req.log.info({ payload }, 'Callback received on XRPC endpoint')

      try {
        // Call shared handler
        await handleQuickLoginCallback(payload, ctx, req.log)

        // Return success to provider
        return {
          encoding: 'application/json',
          body: { success: true },
        }
      } catch (error) {
        // Map errors to XRPC errors
        const err = error as any

        if (err.code === 'InvitationRequired') {
          throw new InvalidRequestError(err.message, 'InvitationRequired')
        }

        if (err.message === 'Session not found') {
          throw new InvalidRequestError(err.message, 'NotFound')
        }

        // All other errors as InvalidRequestError
        if (err.message) {
          throw new InvalidRequestError(err.message)
        }

        throw error
      }
    },
  })
}
