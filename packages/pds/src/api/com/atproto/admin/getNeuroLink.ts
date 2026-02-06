import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ params }) => {
      const { did } = params

      const [account, neuroLink] = await Promise.all([
        ctx.accountManager.getAccount(did),
        ctx.accountManager.db.db
          .selectFrom('neuro_identity_link')
          .selectAll()
          .where('did', '=', did)
          .executeTakeFirst(),
      ])

      if (!account) {
        throw new InvalidRequestError('Account not found', 'NotFound')
      }

      return {
        encoding: 'application/json',
        body: {
          did: account.did,
          handle: account.handle || '',
          email: account.email || undefined,
          neuroJid: neuroLink?.neuroJid || undefined,
          linkedAt: neuroLink?.linkedAt || undefined,
          lastLoginAt: neuroLink?.lastLoginAt || undefined,
        },
      }
    },
  })
}
