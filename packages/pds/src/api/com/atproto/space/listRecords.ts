import { NsidString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util.js'
import { assertSpaceRead, isSpaceSelfRead } from './util.js'

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
      await assertRepoAvailability(ctx, repo, isSpaceSelfRead(auth, repo))

      const records = await ctx.actorStore.read(repo, (store) =>
        store.space.listRecords(space, {
          limit,
          cursor,
          reverse,
          collection,
          excludeValues,
        }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: records.at(-1)?.uri,
          records: records.map((record) => ({
            collection: record.collection as NsidString,
            rkey: record.rkey,
            cid: record.cid,
            value: record.value,
          })),
        },
      }
    },
  })
}
