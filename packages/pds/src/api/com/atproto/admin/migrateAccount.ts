import { AtpAgent } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

// Allowed target PDS domains for W Social infrastructure
const ALLOWED_TARGET_DOMAINS = [
  'wsocial.eu',
  'wsocial.network',
  'wsocial.cloud',
  'wsocial.dev',
]

function validateTargetDomain(targetPdsUrl: string): void {
  const url = new URL(targetPdsUrl)
  const domain = url.hostname

  const isAllowed = ALLOWED_TARGET_DOMAINS.some((allowed) =>
    domain.endsWith(allowed),
  )

  if (!isAllowed) {
    throw new InvalidRequestError(
      `Target PDS domain not allowed. Must end with one of: ${ALLOWED_TARGET_DOMAINS.join(', ')}`,
      'InvalidTargetDomain',
    )
  }
}

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.migrateAccount({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input, req }) => {
      const { did, targetPdsUrl, targetHandle, skipDeactivation } = input.body

      req.log.info(
        { did, targetPdsUrl, targetHandle, skipDeactivation },
        'Starting admin account migration',
      )

      // Step 1: Validate target domain whitelist
      try {
        validateTargetDomain(targetPdsUrl)
        req.log.info({ targetPdsUrl }, 'Target domain validated')
      } catch (err) {
        req.log.error({ targetPdsUrl, err }, 'Invalid target domain')
        throw err
      }

      // Step 2: Validate account exists on source PDS
      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: false, // Don't migrate taken down accounts
      })

      if (!account) {
        throw new InvalidRequestError('Account not found', 'AccountNotFound')
      }

      req.log.info(
        { did, handle: account.handle, email: account.email },
        'Account found on source PDS',
      )

      // Step 3: Export W ID (Neuro identity link)
      const neuroLink = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      req.log.info(
        { did, hasNeuroLink: !!neuroLink, legalId: neuroLink?.legalId },
        'Retrieved Neuro identity link',
      )

      // Step 4: Export app passwords
      const appPasswords = await ctx.accountManager.db.db
        .selectFrom('app_password')
        .selectAll()
        .where('did', '=', did)
        .execute()

      req.log.info(
        { did, appPasswordCount: appPasswords.length },
        'Retrieved app passwords',
      )

      // Step 5: Create agent for target PDS
      const targetAgent = new AtpAgent({ service: targetPdsUrl })

      // Create local agent for getting service auth and repo export
      const localAgent = new AtpAgent({
        service: `http://localhost:${ctx.cfg.service.port}`,
      })

      // Get service auth token for server-to-server communication
      const serviceAuthRes = await localAgent.com.atproto.server.getServiceAuth(
        {
          aud: `did:web:${new URL(targetPdsUrl).hostname}`,
          lxm: 'com.atproto.admin.importAccount',
          exp: Math.floor(Date.now() / 1000) + 60 * 5, // 5 minutes
        },
      )

      const serviceJwt = serviceAuthRes.data.token

      req.log.info({ did, targetPdsUrl }, 'Service auth token obtained')

      try {
        // Step 6: Import account to target PDS (server-to-server)
        // Use fetch directly since admin endpoints aren't in @atproto/api
        const importResponse = await fetch(
          `${targetPdsUrl}/xrpc/com.atproto.admin.importAccount`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceJwt}`,
            },
            body: JSON.stringify({
              did,
              handle: targetHandle || account.handle || '',
              email: account.email || '',
              emailConfirmed: !!account.emailConfirmedAt,
              neuroLink: neuroLink
                ? {
                    legalId: neuroLink.legalId,
                    linkedAt: neuroLink.linkedAt,
                    lastLoginAt: neuroLink.lastLoginAt,
                  }
                : undefined,
              appPasswords: appPasswords.map((p) => ({
                name: p.name,
                passwordScrypt: p.passwordScrypt,
                privileged: !!p.privileged,
                createdAt: p.createdAt,
              })),
            }),
          },
        )

        if (!importResponse.ok) {
          const error = await importResponse.text()
          throw new Error(`Import account failed: ${error}`)
        }

        const importData = await importResponse.json()

        req.log.info(
          { did, targetPds: targetPdsUrl, importData },
          'Account imported to target PDS',
        )

        // Step 7: Export and import repo
        const repoRes = await localAgent.com.atproto.sync.getRepo({ did })

        req.log.info(
          { did, repoSize: repoRes.data.byteLength },
          'Repo exported from source',
        )

        await targetAgent.com.atproto.repo.importRepo(repoRes.data, {
          headers: {
            authorization: `Bearer ${serviceJwt}`,
          },
          encoding: 'application/vnd.ipld.car',
        })

        req.log.info({ did }, 'Repo imported to target PDS')

        // Step 8: Deactivate on source PDS (unless skipDeactivation)
        if (!skipDeactivation) {
          await ctx.accountManager.deactivateAccount(did, null)

          // Explicitly invalidate sessions
          await ctx.accountManager.db.db
            .deleteFrom('refresh_token')
            .where('did', '=', did)
            .execute()

          req.log.info({ did }, 'Account deactivated on source PDS')
        }

        return {
          encoding: 'application/json' as const,
          body: {
            did,
            sourcePds: ctx.cfg.service.hostname,
            targetPds: targetPdsUrl,
            status: 'completed' as const,
            migratedAt: new Date().toISOString(),
            details: {
              neuroLinkMigrated: !!neuroLink,
              appPasswordsMigrated: appPasswords.length,
            },
          },
        }
      } catch (error) {
        req.log.error({ did, error }, 'Migration failed - attempting rollback')

        // Auto-rollback: try to reactivate account on source
        try {
          if (!skipDeactivation) {
            await ctx.accountManager.activateAccount(did)
            req.log.info({ did }, 'Account reactivated on source PDS')
          }

          // Try to cleanup target (best effort)
          try {
            await fetch(
              `${targetPdsUrl}/xrpc/com.atproto.admin.deleteAccount`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${serviceJwt}`,
                },
                body: JSON.stringify({ did }),
              },
            )
            req.log.info({ did }, 'Cleaned up account on target PDS')
          } catch (cleanupErr) {
            req.log.warn(
              { did, cleanupErr },
              'Failed to cleanup target PDS - manual intervention may be needed',
            )
          }
        } catch (rollbackErr) {
          req.log.error(
            { did, rollbackErr },
            'ROLLBACK FAILED - MANUAL INTERVENTION REQUIRED',
          )
        }

        throw new InvalidRequestError(
          'Migration failed. Account reactivated on source.',
          'MigrationFailed',
        )
      }
    },
  })
}
