import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { actionEventTypes, modEventToEventView } from '../../history/views'
import { Server } from '../../lexicon'
import { EventView } from '../../lexicon/types/tools/ozone/history/defs'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.history.getAccountActions({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ auth, params }) => {
      const access = auth.credentials
      const { limit, cursor, account, sortDirection } = params
      const db = ctx.db

      // Allow admins to check mod history for any reporter
      let viewerDid: string | null = null
      if (access.type === 'admin_token') {
        if (!account) {
          throw new Error('Admins must provide an account param')
        }
        viewerDid = account
      } else if (access.iss) {
        viewerDid = access.iss
      }

      if (!viewerDid) {
        throw new InvalidRequestError('unauthorized')
      }

      const modService = ctx.modService(db)
      const results = await modService.getEvents({
        subject: viewerDid,
        limit,
        cursor,
        types: [...actionEventTypes],
        sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
        addedLabels: [],
        removedLabels: [],
        addedTags: [],
        removedTags: [],
        collections: [],
        includeAllUserRecords: true,
      })

      const events: EventView[] = []
      for (const item of results.events) {
        const view = modEventToEventView(item)
        if (view) events.push(view)
      }

      return {
        encoding: 'application/json',
        body: {
          events,
          cursor: results.cursor,
        },
      }
    },
  })
}
