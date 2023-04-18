import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ params }) => {
    const { repo, collection, rkey, cid } = params
    const did = await ctx.services.account(ctx.db).getDidForActor(repo)

    if (!did) {
      throw new InvalidRequestError(`Could not find repo: ${repo}`)
    }

    const uri = AtUri.make(did, collection, rkey)

    const record = await ctx.services.record(ctx.db).getRecord(uri, cid || null)
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: {
        uri: record.uri,
        cid: record.cid,
        value: record.value,
      },
    }
  })
}
