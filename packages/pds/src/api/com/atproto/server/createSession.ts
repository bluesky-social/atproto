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

      // REMOTELOGIN AUTHENTICATION FLOW
      // Check if password looks like a Legal ID (contains @legal.)
      if (input.body.password?.includes('@legal.') && ctx.neuroRemoteLoginManager) {
        const legalId = input.body.password
        const identifier = input.body.identifier

        const purpose = `Sign in as ${identifier}`

        // Initiate RemoteLogin petition
        const { petitionId } = await ctx.neuroRemoteLoginManager.initiatePetition(
          legalId,
          purpose,
        )

        // Wait for user approval
        const approval = await ctx.neuroRemoteLoginManager.waitForApproval(petitionId)

        // Look up account by Legal ID
        req.log.info({ legalId }, 'Looking up account by Legal ID')

        // First, check if the table exists and has data
        const allLinks = await ctx.accountManager.db.db
          .selectFrom('neuro_identity_link')
          .selectAll()
          .execute()

        req.log.info({ allLinks }, 'All neuro_identity_link records')

        const accountLink = await ctx.accountManager.db.db
          .selectFrom('neuro_identity_link')
          .select(['did', 'neuroJid'])
          .where('neuroJid', '=', legalId)
          .executeTakeFirst()

        req.log.info({ accountLink, legalId }, 'Account lookup result')

        if (!accountLink) {
          throw new AuthRequiredError('No account linked to this Legal ID')
        }

        const user = await ctx.accountManager.getAccount(accountLink.did, {
          includeDeactivated: true,
          includeTakenDown: true,
        })

        if (!user) {
          throw new AuthRequiredError('Account not found')
        }

        const isSoftDeleted = false // RemoteLogin users are trusted
        const appPassword = null

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
