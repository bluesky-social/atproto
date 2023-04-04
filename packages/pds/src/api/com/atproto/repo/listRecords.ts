import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.listRecords(async ({ params }) => {
    const {
      repo,
      collection,
      limit = 50,
      cursor,
      rkeyStart,
      rkeyEnd,
      reverse = false,
    } = params

    const did = await ctx.services.account(ctx.db).getDidForActor(repo)
    if (!did) {
      throw new InvalidRequestError(`Could not find repo: ${repo}`)
    }

    const records = await ctx.services.record(ctx.db).listRecordsForCollection({
      did,
      collection,
      limit,
      reverse,
      cursor,
      rkeyStart,
      rkeyEnd,
    })

    const lastRecord = records.at(-1)
    const lastUri = lastRecord && new AtUri(lastRecord?.uri)

    return {
      encoding: 'application/json',
      body: {
        records,
        // Paginate with `before` by default, paginate with `after` when using `reverse`.
        cursor: lastUri?.rkey,
      },
    }
  })
}
