import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxViewerDid } from '../../inbox/access.js'
import { getSeenAt } from '../../inbox/seen.js'
import { hydrateSubjectViews } from '../../inbox/subject-batch.js'
import { queryActionedSubjects } from '../../inbox/subjects.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.listActionedSubjects, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const did = inboxViewerDid(auth, params.did)
      const seenAt = await getSeenAt(ctx.db, did, 'subjects')
      const { rows, cursor } = await queryActionedSubjects(
        ctx.db,
        did,
        params,
        seenAt,
      )
      const subjects = await hydrateSubjectViews(
        ctx.db,
        did,
        rows,
        ctx.cfg.service.did,
        ctx.cfg.inbox,
        seenAt,
      )
      return {
        encoding: 'application/json',
        body: { cursor, subjects },
      }
    },
  })
}
