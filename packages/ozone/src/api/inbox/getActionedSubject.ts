import {
  ForbiddenError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { getSeenAt } from '../../inbox/seen.js'
import {
  findActionedSubject,
  getActionedSubjectDetail,
} from '../../inbox/subjects.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getActionedSubject, {
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
      const subject = await findActionedSubject(ctx.db, did, params.subject)
      if (!subject)
        throw new InvalidRequestError('Subject not found', 'NotFound')
      const seenAt = await getSeenAt(ctx.db, did, 'subjects')
      const detail = await getActionedSubjectDetail(
        ctx.db,
        subject,
        ctx.cfg.service.did,
        ctx.cfg.inbox,
        seenAt,
      )
      if (!detail)
        throw new InvalidRequestError('Subject not found', 'NotFound')
      return { encoding: 'application/json', body: detail }
    },
  })
}
