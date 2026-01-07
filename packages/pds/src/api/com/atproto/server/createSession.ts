import { DAY, MINUTE } from '@atproto/common'
import { DidString, HandleString, INVALID_HANDLE } from '@atproto/syntax'
import { AuthRequiredError, Server } from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager'
import { OLD_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  server.add(com.atproto.server.createSession, {
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
    handler: entrywayClient
      ? async ({ input: { body }, req }) => {
          const { headers } = ctx.entrywayPassthruHeaders(req)
          return entrywayClient.xrpc(com.atproto.server.createSession, {
            validateResponse: false, // ignore invalid upstream responses
            headers,
            body,
          })
        }
      : async ({
          input: { body },
        }): Promise<com.atproto.server.createSession.Output> => {
          if (body.password.length > OLD_PASSWORD_MAX_LENGTH) {
            throw new AuthRequiredError(
              'Password too long. Consider resetting your password.',
            )
          }

          const { user, isSoftDeleted, appPassword } =
            await ctx.accountManager.login(body)

          if (!body.allowTakendown && isSoftDeleted) {
            throw new AuthRequiredError(
              'Account has been taken down',
              'AccountTakedown',
            )
          }

          const [{ accessJwt, refreshJwt }, didDoc] = await Promise.all([
            ctx.accountManager.createSession(
              user.did,
              appPassword,
              isSoftDeleted,
            ),
            didDocForSession(ctx, user.did),
          ])

          const { status, active } = formatAccountStatus(user)

          return {
            encoding: 'application/json',
            body: {
              accessJwt,
              refreshJwt,

              did: user.did as DidString,
              // @ts-expect-error https://github.com/bluesky-social/atproto/pull/4406
              didDoc,
              handle: (user.handle ?? INVALID_HANDLE) as HandleString,
              email: user.email ?? undefined,
              emailConfirmed: !!user.emailConfirmedAt,
              active,
              status,
            },
          }
        },
  })
}
