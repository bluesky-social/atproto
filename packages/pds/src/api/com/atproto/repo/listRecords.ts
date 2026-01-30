import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(
    com.atproto.repo.listRecords,
    async ({ params }): Promise<com.atproto.repo.listRecords.Output> => {
      const { repo, collection, limit = 50, cursor, reverse = false } = params

      const did = await ctx.accountManager.getDidForActor(repo)
      if (!did) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      }

      const records = await ctx.actorStore.read(did, (store) =>
        store.record.listRecordsForCollection({
          collection,
          limit,
          reverse,
          cursor,
        }),
      )

      const lastRecord = records.at(-1)
      const lastUri = lastRecord && new AtUri(lastRecord?.uri)

      return {
        encoding: 'application/json' as const,
        body: {
          records,
          // Paginate with `before` by default, paginate with `after` when using `reverse`.
          cursor: lastUri?.rkey,
        },
      }
    },
  )
}
