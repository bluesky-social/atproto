import { NsidString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { formatListCursor } from '../../../../actor-store/space/reader.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceRead } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRecords, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, collection, limit, cursor, reverse, excludeValues } =
        params

      assertSpaceRead(auth, space, repo)

      const records = await ctx.actorStore.read(repo, (store) =>
        store.space.listRecords(space, {
          limit: limit ?? 50,
          cursor,
          reverse,
          collection,
          includeValues: !excludeValues,
        }),
      )

      const last = records.at(-1)
      const nextCursor = last
        ? formatListCursor(last.collection, last.rkey)
        : undefined

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: nextCursor,
          records: records.map((r) => ({
            collection: r.collection as NsidString,
            rkey: r.rkey,
            cid: r.cid,
            value: r.value,
          })),
        },
      }
    },
  })
}
