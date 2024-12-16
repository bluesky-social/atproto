import { DAY, MINUTE } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ComAtprotoModerationDefs } from '@atproto/api'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru, resultPassthru } from '../../../proxy'
import { parseProxyInfo } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.appealAccountAction({
    // @TODO: we probably will be fine with a very high rate limit on this endpoint
    rateLimit: [
      {
        durationMs: DAY,
        points: 300,
        calcKey: ({ input, req }) => `${input.body.identifier}-${req.ip}`,
      },
      {
        durationMs: 5 * MINUTE,
        points: 30,
        calcKey: ({ input, req }) => `${input.body.identifier}-${req.ip}`,
      },
    ],
    handler: async ({ input, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.appealAccountAction(
            input.body,
            authPassthru(req, true),
          ),
        )
      }

      const { user, isSoftDeleted } = await ctx.accountManager.login(input.body)

      // If user is not soft deleted, they should not be able to send appeals through this route
      if (!isSoftDeleted) {
        throw new InvalidRequestError(
          'No account action found',
          'InvalidAppeal',
        )
      }

      // If no moderationAgent is configured, we can't route the appeal to the right mod instance
      if (!ctx.moderationAgent) {
        throw new InvalidRequestError(
          'Moderation service not configured',
          'InvalidAppeal',
        )
      }

      // Create a service token just for the purpose of creating the appeal report and send the appeal using that token
      const lxm = 'com.atproto.moderation.createReport'
      const { did: aud } = await parseProxyInfo(ctx, req, lxm)
      const serviceJwt = await ctx.serviceAuthJwt(user.did, aud, lxm)
      await ctx.moderationAgent.com.atproto.moderation.createReport(
        {
          reasonType: ComAtprotoModerationDefs.REASONAPPEAL,
          reason: input.body.comment,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: user.did,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${serviceJwt}`,
          },
        },
      )

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
