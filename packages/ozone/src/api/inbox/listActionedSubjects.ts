import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { getSeenAt } from '../../inbox/seen.js'
import { hydrateSubjectViews } from '../../inbox/subject-batch.js'
import { queryActionedSubjects } from '../../inbox/subjects.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.listActionedSubjects, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const did = params.did ?? auth.credentials.iss
      if (
        did !== auth.credentials.iss &&
        !(
          auth.credentials.isModerator ||
          auth.credentials.isTriage ||
          auth.credentials.isAdmin
        )
      ) {
        throw new ForbiddenError('Unauthorized')
      }
      const [seenAt, { rows, cursor }] = await Promise.all([
        getSeenAt(ctx.db, did, 'subjects'),
        queryActionedSubjects(ctx.db, did, params),
      ])
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
