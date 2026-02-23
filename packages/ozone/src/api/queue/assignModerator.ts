import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.assignModerator({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const queueId = input.body.queueId
      const authDid =
        auth.credentials.type === 'moderator'
          ? auth.credentials.iss
          : auth.credentials.type === 'admin_token'
            ? ctx.cfg.service.did
            : undefined
      const did = input.body.did ?? authDid
      const assign = input.body.assign !== false

      if (!auth.credentials.isAdmin && !auth.credentials.isModerator) {
        throw new ForbiddenError('Unauthorized')
      }
      if (!did) {
        throw new InvalidRequestError('DID is required')
      }
      if (did !== authDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Cannot assign others')
      }

      const result = await ctx.assignmentService.assignQueue({ did, queueId, assign })

      return {
        encoding: 'application/json' as const,
        body: {
          id: result.id,
          did: result.did,
          reportId: result.reportId ?? undefined,
          queueId: result.queueId!,
          startAt: result.startAt,
          endAt: result.endAt,
        },
      }
    },
  })
}
