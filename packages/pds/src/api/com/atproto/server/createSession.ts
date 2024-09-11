import { DAY, MINUTE } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'

import { formatAccountStatus } from '../../../../account-manager'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru, resultPassthru } from '../../../proxy'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createSession({
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
        //TODO: probablu need this
        // return resultPassthru(
        //   await ctx.entrywayAgent.com.atproto.server.createSession(
        //     input.body,
        //     authPassthru(req, true),
        //   ),
        // )
      }

      const { user, appPassword } = await ctx.accountManager.login(input.body)

      const [{ accessJwt, refreshJwt }, didDoc] = await Promise.all([
        ctx.accountManager.createSession(user.did, appPassword),
        didDocForSession(ctx, user.did),
      ])

      const { status, active } = formatAccountStatus(user)

      return {
        encoding: 'application/json',
        body: {
          did: user.did,
          didDoc,
          handle: user.handle ?? INVALID_HANDLE,
          email: user.email ?? undefined,
          ethAddress: user.ethAddress ?? undefined,
          emailConfirmed: !!user.emailConfirmedAt,
          accessJwt,
          refreshJwt,
          active,
          status,
        },
      }
    },
  })
}
