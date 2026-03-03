import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ params }) => {
      const { did } = params

      const [account, neuroLinks] = await Promise.all([
        ctx.accountManager.getAccount(did),
        ctx.accountManager.db.db
          .selectFrom('neuro_identity_link')
          .selectAll()
          .where('did', '=', did)
          .orderBy('linkedAt', 'asc')
          .execute(),
      ])

      if (!account) {
        throw new InvalidRequestError('Account not found', 'NotFound')
      }

      const primary = neuroLinks[0] // oldest row is canonical

      return {
        encoding: 'application/json',
        body: {
          did: account.did,
          handle: account.handle || '',
          email: account.email || undefined,
          // Top-level scalar fields use the primary (oldest) row for backward compat
          legalId: primary?.userJid || primary?.testUserJid || undefined,
          jid: primary?.testUserJid || undefined,
          isTestUser: primary ? Boolean(primary.isTestUser) : undefined,
          linkedAt: primary?.linkedAt || undefined,
          lastLoginAt: primary?.lastLoginAt || undefined,
          // Full list of all rows — duplicates visible when present
          neuroLinks: neuroLinks.map((l) => ({
            legalId: l.userJid || l.testUserJid || undefined,
            jid: l.testUserJid || undefined,
            isTestUser: Boolean(l.isTestUser),
            linkedAt: l.linkedAt || undefined,
            lastLoginAt: l.lastLoginAt || undefined,
          })),
          duplicateLinks: neuroLinks.length > 1,
        },
      }
    },
  })
}
