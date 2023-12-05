import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { proxy, resultPassthru } from '../../../proxy'

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

    const account = await ctx.services.account(ctx.db).getAccount(repo)
    if (!account) {
      throw new InvalidRequestError(`Could not find repo: ${repo}`)
    }

    const proxied = await proxy(ctx, account.pdsDid, async (agent) => {
      const result = await agent.api.com.atproto.repo.listRecords(params)
      return resultPassthru(result)
    })
    if (proxied !== null) {
      return proxied
    }

    const records = await ctx.services.record(ctx.db).listRecordsForCollection({
      did: account.did,
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
