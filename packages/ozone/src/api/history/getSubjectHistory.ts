import { Server } from '../../lexicon'
import AppContext from '../../context'
import { EventView } from '../../lexicon/types/tools/ozone/history/defs'
import { publishableModEvents } from '../../history/status'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.history.getSubjectHistory({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ auth, params }) => {
      const access = auth.credentials
      const { limit, cursor, subject } = params
      const db = ctx.db

      // Allow admins to check mod history for any reporter
      let viewerDid: string | null
      if (access.type !== 'admin_token') {
        viewerDid = access.iss
        if (!viewerDid) {
          throw new InvalidRequestError('Unauthorized')
        }
        // Users should only be able to view history for their own account
        if (subject.startsWith('did:') && subject !== viewerDid) {
          throw new InvalidRequestError('Unauthorized')
        }

        // Users should only be able to view history for their own records
        if (
          subject.startsWith('at://') &&
          !subject.startsWith(`at://${viewerDid}`)
        ) {
          throw new InvalidRequestError('Unauthorized')
        }
      }

      const modHistoryService = ctx.modStatusHistoryService(db)
      const modService = ctx.modService(db)
      const results = await modService.getEvents({
        subject,
        limit,
        cursor,
        types: publishableModEvents,
        addedLabels: [],
        removedLabels: [],
        addedTags: [],
        removedTags: [],
        collections: [],
        includeAllUserRecords: false,
      })

      const events: EventView[] = []

      for (const item of results.events) {
        const view = modHistoryService.eventView(item)
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
