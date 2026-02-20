import { ForbiddenError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.report.claimReport({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const authDid =
        auth.credentials.type === 'moderator'
          ? auth.credentials.iss
          : auth.credentials.type === 'admin_token'
            ? ctx.cfg.service.did
            : undefined

      if (!authDid) {
        throw new ForbiddenError('No one to assign report to')
      }

      const result = await ctx.assignmentService.claimReport({
        did: authDid,
        reportId: input.body.reportId,
        queueId: input.body.queueId,
        assign: input.body.assign || false,
      })
      ctx.assignmentWss.broadcast({
        type: input.body.assign
          ? 'report:review:started'
          : 'report:review:ended',
        reportId: result.reportId!,
        moderator: {
          did: result.did,
        },
        queues: result.queueId != null ? [result.queueId] : [],
      })

      return {
        encoding: 'application/json' as const,
        body: {
          id: result.id,
          did: result.did,
          reportId: result.reportId!,
          queueId: result.queueId ?? undefined,
          startAt: result.startAt,
          endAt: result.endAt,
        },
      }
    },
  })
}
