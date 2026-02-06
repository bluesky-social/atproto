import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.quicklogin.status({
    handler: async ({ input, req }) => {
      if (!ctx.cfg.quicklogin) {
        throw new InvalidRequestError('QuickLogin not enabled')
      }

      const { sessionId, sessionToken } = input.body as {
        sessionId: string
        sessionToken: string
      }

      if (!sessionId || !sessionToken) {
        throw new InvalidRequestError('Missing sessionId or sessionToken')
      }

      const session = ctx.quickloginStore.getSession(sessionId)
      if (!session || session.sessionToken !== sessionToken) {
        throw new InvalidRequestError('Invalid session', 'NotFound')
      }

      return {
        encoding: 'application/json',
        body: {
          status: session.status,
          result: session.result || undefined,
          error: session.error || undefined,
          expiresAt: session.expiresAt,
        },
      }
    },
  })
}
