import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.listBlobs({
    auth: ctx.authVerifier.optionalAccessOrRole,
    handler: async ({ params, auth }) => {
      const { did, since, limit, cursor } = params
      // takedown check for anyone other than an admin or the user
      if (!ctx.authVerifier.isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find root for DID: ${did}`)
        }
      }

      let builder = ctx.db.db
        .selectFrom('repo_blob')
        .where('did', '=', did)
        .select('cid')
        .orderBy('cid', 'asc')
        .groupBy('cid')
        .limit(limit)
      if (since) {
        builder = builder.where('repoRev', '>', since)
      }

      if (cursor) {
        builder = builder.where('cid', '>', cursor)
      }

      const res = await builder.execute()

      return {
        encoding: 'application/json',
        body: {
          cursor: res.at(-1)?.cid,
          cids: res.map((row) => row.cid),
        },
      }
    },
  })
}
