import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ params }) => {
    const { user, collection, rkey, cid } = params

    const did = await ctx.services.account(ctx.db).getDidForActor(user)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    const uri = new AtUri(`${did}/${collection}/${rkey}`)

    const record = await ctx.services.record(ctx.db).getRecord(uri, cid || null)
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: record,
    }
  })
}
