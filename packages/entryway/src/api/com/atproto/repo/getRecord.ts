import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { proxy, resultPassthru } from '../../../proxy'
import { softDeleted } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ params }) => {
    const { repo, collection, rkey, cid } = params
    const account = await ctx.services.account(ctx.db).getAccount(repo)

    // fetch from pds if available, if not then fetch from appview
    if (!account) {
      const res = await ctx.appViewAgent.api.com.atproto.repo.getRecord(params)
      return resultPassthru(res)
    }

    const proxied = await proxy(ctx, account.pdsDid, async (agent) => {
      const result = await agent.api.com.atproto.repo.getRecord(params)
      return resultPassthru(result)
    })
    if (proxied !== null) {
      return proxied
    }

    const uri = AtUri.make(account.did, collection, rkey)
    const record = await ctx.services.record(ctx.db).getRecord(uri, cid || null)
    if (!record || softDeleted(record)) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }

    return {
      encoding: 'application/json',
      body: {
        uri: uri.toString(),
        cid: record.cid,
        value: record.value,
      },
    }
  })
}
