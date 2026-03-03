import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.listNeuroAccounts({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ params }) => {
      const { limit = 100, cursor } = params

      // Query all accounts using the selectAccountQB pattern from account helpers
      const { ref } = ctx.accountManager.db.db.dynamic
      let query = ctx.accountManager.db.db
        .selectFrom('actor')
        .leftJoin('account', 'actor.did', 'account.did')
        .select([
          'actor.did as did',
          'actor.handle as handle',
          'account.email as email',
        ])
        .where('actor.deactivatedAt', 'is', null)
        .where((qb) =>
          qb
            .where('actor.takedownRef', 'is', null)
            .orWhere('actor.takedownRef', '=', ''),
        )

      if (cursor) {
        query = query.where('actor.handle', '>', cursor)
      }

      const accounts = await query
        .orderBy('actor.handle', 'asc')
        .limit(limit + 1)
        .execute()

      // Query ALL neuro links (a DID may have multiple rows — e.g. one from the
      // webhook with the real legalId and one from the first QuickLogin with the
      // JID stored as legalId by the old code).
      const dids = accounts.map((acc) => acc.did)
      const allNeuroLinks = dids.length
        ? await ctx.accountManager.db.db
            .selectFrom('neuro_identity_link')
            .selectAll()
            .where('did', 'in', dids)
            .orderBy('linkedAt', 'asc')
            .execute()
        : []

      // Group all rows by DID
      const neuroLinksByDid = new Map<string, typeof allNeuroLinks>()
      for (const link of allNeuroLinks) {
        const existing = neuroLinksByDid.get(link.did) ?? []
        existing.push(link)
        neuroLinksByDid.set(link.did, existing)
      }

      // Paginate
      const hasMore = accounts.length > limit
      const accountsToReturn = hasMore ? accounts.slice(0, limit) : accounts
      const nextCursor = hasMore
        ? accountsToReturn[accountsToReturn.length - 1].handle
        : undefined

      return {
        encoding: 'application/json',
        body: {
          accounts: accountsToReturn.map((account) => {
            const links = neuroLinksByDid.get(account.did) ?? []
            const primary = links[0] // oldest row (from webhook) is the canonical one
            return {
              did: account.did,
              handle: account.handle || '',
              email: account.email || undefined,
              // Top-level scalar fields use the primary (oldest) row for backward compat
              legalId: primary?.userJid || primary?.testUserJid || undefined,
              jid: primary?.testUserJid || undefined,
              isTestUser: primary ? Boolean(primary.isTestUser) : undefined,
              linkedAt: primary?.linkedAt || undefined,
              lastLoginAt: primary?.lastLoginAt || undefined,
              // Full list of all rows — includes duplicates when present
              neuroLinks: links.map((l) => ({
                legalId: l.userJid || l.testUserJid || undefined,
                jid: l.testUserJid || undefined,
                isTestUser: Boolean(l.isTestUser),
                linkedAt: l.linkedAt || undefined,
                lastLoginAt: l.lastLoginAt || undefined,
              })),
              duplicateLinks: links.length > 1,
            }
          }),
          cursor: nextCursor || undefined,
        },
      }
    },
  })
}
