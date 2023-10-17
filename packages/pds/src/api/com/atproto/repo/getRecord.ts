import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ params }) => {
    const { repo, collection, rkey, cid } = params
    const did = await ctx.services.account(ctx.db).getDidForActor(repo)

    // fetch from pds if available, if not then fetch from appview
    if (did) {
      const uri = AtUri.make(did, collection, rkey)
      const record = await ctx.services
        .record(ctx.db)
        .getRecord(uri, cid || null)
      if (!record || record.takedownId !== null) {
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
    }

    const res = await ctx.appViewAgent.api.com.atproto.repo.getRecord(params)
    return {
      encoding: 'application/json',
      body: res.data,
    }
  })
}
