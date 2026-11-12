import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import { assertSpaceRead, isSpaceUserOrAdmin, toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRecords, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, collection, limit, cursor, excludeValues } = params

      assertSpaceRead(auth, toSpaceRef(space), repo)
      await assertRepoAvailability(ctx, repo, isSpaceUserOrAdmin(auth, repo))

      const records = await ctx.actorStore.read(repo, (store) =>
        store.space.listRecords(space, {
          limit,
          cursor,
          collection,
          excludeValues,
        }),
      )

      return {
        encoding: 'application/json',
        body: {
          cursor: records.length < limit ? undefined : records.at(-1)?.uri,
          records: records.map((record) => ({
            collection: record.collection,
            rkey: record.rkey,
            cid: record.cid,
            value: record.value,
          })),
        },
      }
    },
  })
}
