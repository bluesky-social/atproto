import { Secp256k1Keypair } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.importAccount({
    auth: ctx.authVerifier.userServiceAuth,
    handler: async ({ input, req }) => {
      const { did, handle, email, emailConfirmed, neuroLink, appPasswords } =
        input.body

      req.log.info(
        {
          did,
          handle,
          email,
          hasNeuroLink: !!neuroLink,
          appPasswordCount: appPasswords?.length || 0,
        },
        'Importing account from another PDS',
      )

      // Pre-flight validation: Check if DID already exists
      const existingActor = await ctx.accountManager.db.db
        .selectFrom('actor')
        .select('did')
        .where('did', '=', did)
        .executeTakeFirst()

      if (existingActor) {
        throw new InvalidRequestError(
          'Account with this DID already exists on target PDS',
          'AccountExists',
        )
      }

      // Pre-flight validation: Check W ID uniqueness
      if (neuroLink?.legalId) {
        const existingLink = await ctx.accountManager.db.db
          .selectFrom('neuro_identity_link')
          .select(['did', 'legalId'])
          .where('legalId', '=', neuroLink.legalId)
          .executeTakeFirst()

        if (existingLink && existingLink.did !== did) {
          throw new InvalidRequestError(
            `W ID ${neuroLink.legalId} is already linked to a different account`,
            'DuplicateNeuroId',
          )
        }
      }

      // Pre-flight validation: Check handle availability
      const handleTaken = await ctx.accountManager.db.db
        .selectFrom('actor')
        .select('handle')
        .where('handle', '=', handle)
        .executeTakeFirst()

      if (handleTaken) {
        throw new InvalidRequestError(
          `Handle ${handle} is not available`,
          'HandleTaken',
        )
      }

      try {
        // Create signing key for the account
        const signingKey = await Secp256k1Keypair.create({ exportable: true })

        // Create actor (signing key and DID document)
        await ctx.actorStore.create(did, signingKey)

        // Create empty repo
        const commit = await ctx.actorStore.transact(did, (actorTxn) =>
          actorTxn.repo.createRepo([]),
        )

        // Create account (without password - Neuro accounts or will be set later)
        await ctx.accountManager.createAccount({
          did,
          handle,
          email: email || undefined,
          repoCid: commit.cid,
          repoRev: commit.rev,
          // password omitted - Neuro accounts don't use passwords
        })

        req.log.info({ did }, 'Account created on target PDS')

        // Confirm email if it was confirmed on source
        if (emailConfirmed && email) {
          await ctx.accountManager.db.db
            .updateTable('account')
            .set({ emailConfirmedAt: new Date().toISOString() })
            .where('did', '=', did)
            .execute()

          req.log.info({ did }, 'Email marked as confirmed')
        }

        let neuroLinkRestored = false

        // Restore W ID (Neuro identity link)
        if (neuroLink?.legalId) {
          await ctx.accountManager.db.db
            .insertInto('neuro_identity_link')
            .values({
              did,
              legalId: neuroLink.legalId,
              jid: null,
              email: null,
              userName: null,
              isTestUser: 0,
              linkedAt: neuroLink.linkedAt || new Date().toISOString(),
              lastLoginAt: neuroLink.lastLoginAt || null,
            })
            .execute()

          neuroLinkRestored = true
          req.log.info(
            { did, legalId: neuroLink.legalId },
            'Neuro identity link restored',
          )
        }

        let appPasswordsRestored = 0

        // Restore app passwords
        if (appPasswords && appPasswords.length > 0) {
          for (const appPass of appPasswords) {
            await ctx.accountManager.db.db
              .insertInto('app_password')
              .values({
                did,
                name: appPass.name,
                passwordScrypt: appPass.passwordScrypt,
                privileged: appPass.privileged ? 1 : 0,
                createdAt: appPass.createdAt,
              })
              .execute()

            appPasswordsRestored++
          }

          req.log.info(
            { did, count: appPasswordsRestored },
            'App passwords restored',
          )
        }

        return {
          encoding: 'application/json' as const,
          body: {
            did,
            importStatus: {
              accountCreated: true,
              neuroLinkRestored,
              appPasswordsRestored,
            },
          },
        }
      } catch (err) {
        req.log.error({ did, err }, 'Failed to import account')

        // Cleanup: try to delete partially created account
        try {
          await ctx.accountManager.db.db
            .deleteFrom('actor')
            .where('did', '=', did)
            .execute()

          await ctx.accountManager.db.db
            .deleteFrom('account')
            .where('did', '=', did)
            .execute()

          await ctx.accountManager.db.db
            .deleteFrom('neuro_identity_link')
            .where('did', '=', did)
            .execute()

          req.log.info({ did }, 'Cleaned up partial account creation')
        } catch (cleanupErr) {
          req.log.error(
            { did, cleanupErr },
            'Failed to cleanup partial account',
          )
        }

        throw new InvalidRequestError(
          'Failed to import account',
          'ImportFailed',
        )
      }
    },
  })
}
