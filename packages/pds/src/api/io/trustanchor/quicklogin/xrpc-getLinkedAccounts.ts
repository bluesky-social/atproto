import { sql } from 'kysely'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { getHandleForDid } from './helpers'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.quicklogin.getLinkedAccounts({
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Any authenticated user may call this
      },
    }),
    handler: async ({ auth }) => {
      if (!ctx.cfg.quicklogin) {
        throw new Error('QuickLogin not enabled')
      }

      const callerDid = auth.credentials.did

      // The JID is embedded in the access JWT at WID login time.
      // If absent, the session was established via password or OAuth — no switching allowed.
      const loginJid =
        auth.credentials.type === 'access' ? auth.credentials.jid : undefined

      if (!loginJid) {
        // No WID links — return just the caller's own session
        const callerHandle = await getHandleForDid(ctx, callerDid)
        const callerTokens = await ctx.accountManager.createSession(
          callerDid,
          null,
          false,
        )
        return {
          encoding: 'application/json' as const,
          body: {
            accounts: [
              {
                did: callerDid,
                handle: callerHandle,
                accessJwt: callerTokens.accessJwt,
                refreshJwt: callerTokens.refreshJwt,
              },
            ],
          },
        }
      }

      // Find all DIDs linked to the login JID, ordered by lastLoginAt DESC
      const linkedDids = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['did', 'lastLoginAt'])
        .where('jid', '=', loginJid)
        .orderBy(
          sql<string>`COALESCE(lastLoginAt, '1970-01-01T00:00:00.000Z')`,
          'desc',
        )
        .execute()

      // Security: verify the caller's DID is still linked to this JID.
      // If the link has been removed (e.g. admin unlinked the account) we must
      // not expose other accounts that remain linked to the same JID.
      // Fall through to the no-JID path, which returns only the caller's own session.
      const callerIsLinked = linkedDids.some((row) => row.did === callerDid)
      if (!callerIsLinked) {
        const callerHandle = await getHandleForDid(ctx, callerDid)
        const callerTokens = await ctx.accountManager.createSession(
          callerDid,
          null,
          false,
        )
        return {
          encoding: 'application/json' as const,
          body: {
            accounts: [
              {
                did: callerDid,
                handle: callerHandle,
                accessJwt: callerTokens.accessJwt,
                refreshJwt: callerTokens.refreshJwt,
              },
            ],
          },
        }
      }

      // Deduplicate DIDs, caller first
      const seen = new Set<string>()
      const orderedDids: string[] = []
      orderedDids.push(callerDid)
      seen.add(callerDid)
      for (const row of linkedDids) {
        if (!seen.has(row.did)) {
          orderedDids.push(row.did)
          seen.add(row.did)
        }
      }

      // Issue sessions for all linked accounts, embedding the same loginJid
      // so that switching accounts preserves the WID context across refreshes.
      const accounts: {
        did: string
        handle: string
        accessJwt: string
        refreshJwt: string
      }[] = []
      for (const did of orderedDids) {
        try {
          const handle = await getHandleForDid(ctx, did)
          const tokens = await ctx.accountManager.createSession(
            did,
            null,
            false,
            loginJid,
          )
          accounts.push({
            did,
            handle,
            accessJwt: tokens.accessJwt,
            refreshJwt: tokens.refreshJwt,
          })
        } catch (_err) {
          // Skip accounts that fail (e.g. deleted/deactivated)
        }
      }

      return {
        encoding: 'application/json' as const,
        body: { accounts },
      }
    },
  })
}
