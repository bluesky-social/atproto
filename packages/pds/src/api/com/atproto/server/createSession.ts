import { DAY, MINUTE } from '@atproto/common'
import { INVALID_HANDLE } from '@atproto/syntax'
import { AuthRequiredError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { didDocForSession } from './util'
import { authPassthru, resultPassthru } from '../../../proxy'
import { AppPassDescript } from '../../../../account-manager/helpers/password'

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
            authPassthru(req, true),
          ),
        )
      }

      const { password } = input.body
      const identifier = input.body.identifier.toLowerCase()

      const user = identifier.includes('@')
        ? await ctx.accountManager.getAccountByEmail(identifier, {
            includeDeactivated: true,
            includeTakenDown: true,
          })
        : await ctx.accountManager.getAccount(identifier, {
            includeDeactivated: true,
            includeTakenDown: true,
          })

      if (!user) {
        throw new AuthRequiredError('Invalid identifier or password')
      }

      let appPassword: AppPassDescript | null = null
      const validAccountPass = await ctx.accountManager.verifyAccountPassword(
        user.did,
        password,
      )
      if (!validAccountPass) {
        appPassword = await ctx.accountManager.verifyAppPassword(
          user.did,
          password,
        )
        if (appPassword === null) {
          throw new AuthRequiredError('Invalid identifier or password')
        }
      }

      if (softDeleted(user)) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      const [{ accessJwt, refreshJwt }, didDoc] = await Promise.all([
        ctx.accountManager.createSession(user.did, appPassword),
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
          active: user.active,
          status: user.status,
        },
      }
    },
  })
}
