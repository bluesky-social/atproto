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

      // AUTHENTICATION FLOW DECISION
      // 1. Password = "wid" → RemoteLogin (passwordless, approve in Neuro app)
      // 2. Password contains @legal. → RemoteLogin (legacy support)
      // 3. Otherwise → Traditional app password authentication

      const password = input.body.password || ''
      const isRemoteLoginTrigger =
        password.toLowerCase() === 'wid' || password.includes('@legal.')

      // REMOTELOGIN FLOW (triggered by "wid" or Legal ID password)
      if (isRemoteLoginTrigger && ctx.neuroRemoteLoginManager) {
        req.log.info(
          {
            identifier: input.body.identifier,
            trigger: password === 'wid' ? 'wid' : 'legalId',
          },
          'RemoteLogin flow triggered',
        )

        let legalId: string | undefined
        let userForRemoteLogin: any

        // If password is a Legal ID, use it directly and look up account
        if (password.includes('@legal.')) {
          legalId = password

          req.log.info({ legalId }, 'Password is Legal ID - looking up account')

          const accountLink = await ctx.accountManager.db.db
            .selectFrom('neuro_identity_link')
            .select(['did', 'legalId'])
            .where('legalId', '=', legalId)
            .executeTakeFirst()

          if (accountLink) {
            userForRemoteLogin = await ctx.accountManager.getAccount(
              accountLink.did,
              {
                includeDeactivated: true,
                includeTakenDown: true,
              },
            )
          }

          if (!userForRemoteLogin) {
            throw new AuthRequiredError('No account linked to this Legal ID')
          }
        }
        // Otherwise (password = "wid"), look up account by identifier, then get Legal ID
        else {
          req.log.info(
            { identifier: input.body.identifier },
            'Looking up account by identifier for RemoteLogin',
          )

          // Check if identifier is an email address
          const isEmail =
            input.body.identifier.includes('@') &&
            !input.body.identifier.startsWith('did:')

          req.log.info(
            {
              identifier: input.body.identifier,
              isEmail,
              lookupMethod: isEmail
                ? 'getAccountByEmail'
                : 'getAccount (handle/DID)',
            },
            'Determining lookup method',
          )

          const account = isEmail
            ? await ctx.accountManager.getAccountByEmail(
                input.body.identifier,
                {
                  includeDeactivated: true,
                  includeTakenDown: true,
                },
              )
            : await ctx.accountManager.getAccount(input.body.identifier, {
                includeDeactivated: true,
                includeTakenDown: true,
              })

          if (!account) {
            throw new AuthRequiredError('Account not found')
          }

          // Get linked Legal ID for this account
          const accountLink = await ctx.accountManager.db.db
            .selectFrom('neuro_identity_link')
            .select(['legalId'])
            .where('did', '=', account.did)
            .executeTakeFirst()

          if (!accountLink?.legalId) {
            throw new AuthRequiredError(
              'This account does not have a linked Neuro Legal ID. ' +
                'Use your app password instead, or set up Neuro authentication.',
            )
          }

          req.log.info(
            { did: account.did, legalId: accountLink.legalId },
            'Found linked Legal ID for account',
          )
          legalId = accountLink.legalId
          userForRemoteLogin = account
        }

        // At this point we have both legalId and userForRemoteLogin
        // Proceed with RemoteLogin petition
        const identifier = input.body.identifier
        const purpose = `Sign in as ${identifier}`

        req.log.info({ legalId, purpose }, 'Initiating RemoteLogin petition')

        let approval
        try {
          // Initiate RemoteLogin petition
          const { petitionId } =
            await ctx.neuroRemoteLoginManager.initiatePetition(legalId, purpose)

          req.log.info(
            { petitionId, legalId },
            'RemoteLogin petition initiated - waiting for approval',
          )

          // Wait for user approval
          approval =
            await ctx.neuroRemoteLoginManager.waitForApproval(petitionId)

          req.log.info(
            { approved: approval, petitionId },
            'RemoteLogin approved',
          )
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          req.log.warn(
            { error: errorMsg, legalId },
            'RemoteLogin petition failed',
          )

          // Convert petition errors to user-friendly messages
          if (
            errorMsg.includes('timeout') ||
            errorMsg.includes('did not respond')
          ) {
            throw new AuthRequiredError(
              'Authentication request timed out. Please approve the login request on your device and try again.',
            )
          } else if (
            errorMsg.includes('rejected') ||
            errorMsg.includes('denied')
          ) {
            throw new AuthRequiredError(
              'Authentication request was rejected. Please try again.',
            )
          } else if (errorMsg.includes('not found')) {
            throw new AuthRequiredError(
              'Authentication session not found. Please try again.',
            )
          } else {
            // Generic error for other cases (network issues, API errors, etc.)
            throw new AuthRequiredError(
              'Authentication failed. Please check your connection and try again.',
            )
          }
        }

        const user = userForRemoteLogin

        const isSoftDeleted = false // RemoteLogin users are trusted
        const appPassword = null

        if (!input.body.allowTakendown && isSoftDeleted) {
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

      // TRADITIONAL APP PASSWORD AUTHENTICATION
      // Used by third-party apps and when password is not "wid" or Legal ID
      req.log.info(
        { identifier: input.body.identifier },
        'Using traditional password authentication',
      )

      if (password.length > OLD_PASSWORD_MAX_LENGTH) {
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
