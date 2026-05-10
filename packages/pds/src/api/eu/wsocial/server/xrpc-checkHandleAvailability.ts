import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.server.checkHandleAvailability({
    // No auth required — just a handle availability check.
    handler: async ({ params }) => {
      const handle = params.handle as string

      if (!handle || typeof handle !== 'string') {
        throw new InvalidRequestError('handle is required')
      }

      // Normalise: lowercase, trim whitespace
      const normalised = handle.toLowerCase().trim()

      // If caller sent a bare name like "alice", append the primary service domain.
      // If they sent "alice.wsocial.eu" already, use as-is.
      let qualified: string
      if (normalised.includes('.')) {
        qualified = normalised
      } else {
        const primaryDomain = (
          ctx.cfg.identity.serviceHandleDomains?.[0] ?? ctx.cfg.service.hostname
        ).replace(/^\./, '')
        qualified = `${normalised}.${primaryDomain}`
      }

      // A handle is available when no account exists with that handle.
      const existing = await ctx.accountManager.getAccount(qualified)
      const available = existing === null

      return {
        encoding: 'application/json',
        body: { available },
      }
    },
  })
}
