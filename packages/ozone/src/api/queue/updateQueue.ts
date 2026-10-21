import {
  AuthRequiredError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { QueueAccess } from '../../queue/access.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.queue.updateQueue, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to update a queue')
      }

      const {
        queueId,
        name,
        enabled,
        strictAccess,
        description,
        recommendedPolicies,
        recommendedLabels,
      } = input.body

      if (
        name === undefined &&
        enabled === undefined &&
        strictAccess === undefined &&
        description === undefined &&
        recommendedPolicies === undefined &&
        recommendedLabels === undefined
      ) {
        throw new InvalidRequestError(
          'At least one queue property must be provided',
        )
      }

      if (strictAccess !== undefined && !access.isAdmin) {
        throw new AuthRequiredError('Only admins can change strict access')
      }
      const queue = await ctx.db.transaction(async (dbTxn) => {
        const queueService = ctx.queueService(dbTxn)
        const existing = await queueService.getById(queueId, true)
        if (!existing) {
          throw new InvalidRequestError(
            `Queue with id ${queueId} does not exist`,
            'QueueNotFound',
          )
        }
        const queueAccess = await QueueAccess.forActor(dbTxn, access)
        queueAccess.assertQueue(queueId)

        const updates: {
          name?: string
          enabled?: boolean
          strictAccess?: boolean
          description?: string
          recommendedPolicies?: string[]
          recommendedLabels?: string[]
        } = {}
        if (strictAccess !== undefined) updates.strictAccess = strictAccess
        if (name !== undefined) updates.name = name
        if (enabled !== undefined) updates.enabled = enabled
        if (description !== undefined) updates.description = description
        if (recommendedPolicies !== undefined) {
          await queueService.assertRecommendedPolicies(recommendedPolicies)
          updates.recommendedPolicies = recommendedPolicies
        }
        if (recommendedLabels !== undefined) {
          updates.recommendedLabels = recommendedLabels
        }

        await queueService.checkConflict({
          name: name ?? existing.name,
          subjectTypes: existing.subjectTypes,
          collection: existing.collection,
          reportTypes: existing.reportTypes,
          reporterTags: existing.reporterTags,
          accountTags: existing.accountTags,
          recommendedLabels: recommendedLabels ?? existing.recommendedLabels,
          excludeId: queueId,
        })

        return queueService.update(queueId, updates)
      })
      const queueService = ctx.queueService(ctx.db)

      return {
        encoding: 'application/json',
        body: { queue: queueService.view(queue) },
      }
    },
  })
}
