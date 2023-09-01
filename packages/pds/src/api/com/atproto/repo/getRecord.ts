import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ req, params }) => {
    const { repo, collection, rkey, cid } = params
    const did = await ctx.services.account(ctx.db).getDidForActor(repo)

    // fetch from pds if available, if not then fetch from appview
    if (did) {
      const uri = AtUri.make(did, collection, rkey)
      const record = await ctx.services
        .record(ctx.db)
        .getRecord(uri, cid || null)
      if (record) {
        return {
          encoding: 'application/json',
          body: {
            uri: record.uri,
            cid: record.cid,
            value: record.value,
          },
        }
      }
    }

    if (await ctx.canProxyRead(req)) {
      const res = await ctx.appviewAgent.api.com.atproto.repo.getRecord(params)
      return {
        encoding: 'application/json',
        body: res.data,
      }
    } else {
      const uri = AtUri.make(did || repo, collection, rkey)
      throw new InvalidRequestError(
        `Could not locate record: ${uri.toString()}`,
      )
    }
  })
}
