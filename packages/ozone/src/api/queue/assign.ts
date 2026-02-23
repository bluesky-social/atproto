import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

const ASSIGNMENT_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.assign({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      // inputs
      const queueId = input.body.queueId
      const authDid =
        auth.credentials.type === 'moderator'
          ? auth.credentials.iss
          : auth.credentials.type === 'admin_token'
            ? ctx.cfg.service.did
            : undefined
      const did = input.body.did ?? authDid
      const now = new Date()
      const assign = input.body.assign !== false
      const endAt = assign
        ? new Date(now.getTime() + ASSIGNMENT_DURATION_MS)
        : now

      // validation
      if (!did) {
        throw new InvalidRequestError('DID is required')
      }

      // access
      if (did !== authDid && !auth.credentials.isAdmin) {
        throw new ForbiddenError('Cannot assign others')
      }

      const result = await ctx.db.transaction(async (dbTxn) => {
        // Check for an existing active assignment for this moderator + queue
        const existing = await dbTxn.db
          .selectFrom('moderator_assignment')
          .selectAll()
          .where('did', '=', did)
          .where('queueId', '=', queueId)
          .where('reportId', 'is', null)
          .where('endAt', '>', now)
          .executeTakeFirst()

        if (existing) {
          // Refresh or unassign
          const updated = await dbTxn.db
            .updateTable('moderator_assignment')
            .set({
              endAt,
            })
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow()
          return updated
        }

        // Create a new assignment
        const created = await dbTxn.db
          .insertInto('moderator_assignment')
          .values({
            did,
            queueId,
            startAt: now,
            endAt,
          })
          .returningAll()
          .executeTakeFirstOrThrow()
        return created
      })

      return {
        encoding: 'application/json' as const,
        body: {
          id: result.id,
          did: result.did,
          reportId: result.reportId ?? undefined,
          queueId: result.queueId!,
          startAt: result.startAt.toISOString(),
          endAt: result.endAt.toISOString(),
        },
      }
    },
  })
}
