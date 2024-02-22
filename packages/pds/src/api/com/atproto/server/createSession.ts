import { DAY, MINUTE } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'

import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru, resultPassthru } from '../../../proxy'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  const { entrywayAgent } = ctx

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
    handler: entrywayAgent
      ? async ({ input, req }) => {
          return resultPassthru(
            await entrywayAgent.com.atproto.server.createSession(
              input.body,
              authPassthru(req, true),
            ),
          )
        }
      : async ({ input }) => {
          const { user, appPasswordName } = await ctx.accountManager.login(
            input.body,
            true,
          )

          const [{ accessJwt, refreshJwt }, didDoc] = await Promise.all([
            ctx.accountManager.createSession(user.did, appPasswordName),
            didDocForSession(ctx, user.did),
          ])

          return {
            encoding: 'application/json',
            body: {
              did: user.did,
              didDoc,
              handle: user.handle ?? INVALID_HANDLE,
              email: user.email ?? undefined,
              emailConfirmed: !!user.emailConfirmedAt,
              accessJwt,
              refreshJwt,
            },
          }
        },
  })
}
