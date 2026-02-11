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

      // Query neuro links
      const dids = accounts.map((acc) => acc.did)
      const neuroLinks = dids.length
        ? await ctx.accountManager.db.db
            .selectFrom('neuro_identity_link')
            .selectAll()
            .where('did', 'in', dids)
            .execute()
        : []

      const neuroLinkMap = new Map(neuroLinks.map((link) => [link.did, link]))

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
            const neuroLink = neuroLinkMap.get(account.did)
            return {
              did: account.did,
              handle: account.handle || '',
              email: account.email || undefined,
              legalId: neuroLink?.legalId || undefined,
              jid: neuroLink?.jid || undefined,
              isTestUser: neuroLink ? Boolean(neuroLink.isTestUser) : undefined,
              linkedAt: neuroLink?.linkedAt || undefined,
              lastLoginAt: neuroLink?.lastLoginAt || undefined,
            }
          }),
          cursor: nextCursor || undefined,
        },
      }
    },
  })
}
