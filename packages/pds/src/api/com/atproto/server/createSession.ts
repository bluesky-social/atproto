import { DAY, MINUTE } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'
import { AuthRequiredError } from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager'
import { OLD_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { resultPassthru } from '../../../proxy'
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
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.createSession(
            input.body,
            ctx.entrywayPassthruHeaders(req),
          ),
        )
      }

      if (input.body.password.length > OLD_PASSWORD_MAX_LENGTH) {
        throw new AuthRequiredError(
          'Password too long. Consider resetting your password.',
        )
      }

      const { user, isSoftDeleted, appPassword } =
        await ctx.accountManager.login(input.body)

      if (!input.body.allowTakendown && isSoftDeleted) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      const [{ accessJwt, refreshJwt }, didDoc] = await Promise.all([
        ctx.accountManager.createSession(user.did, appPassword, isSoftDeleted),
        didDocForSession(ctx, user.did),
      ])

      const { status, active } = formatAccountStatus(user)

      return {
        encoding: 'application/json',
        body: {
          accessJwt,
          refreshJwt,

          did: user.did,
          didDoc,
          handle: user.handle ?? INVALID_HANDLE,
          email: user.email ?? undefined,
          emailConfirmed: !!user.emailConfirmedAt,
          active,
          status,
        },
      }
    },
  })
}
