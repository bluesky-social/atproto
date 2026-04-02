import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRecords, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did
      const { space, collection, limit, cursor, reverse } = params

      const records = await ctx.actorStore.read(did, (store) =>
        store.space.listRecords(space, collection, {
          limit: limit ?? 50,
          cursor,
          reverse,
        }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: records.at(-1)?.rkey,
          records: records.map((r) => ({
            collection,
            rkey: r.rkey,
            cid: r.cid,
          })),
        },
      }
    },
  })
}
