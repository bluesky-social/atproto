import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { jsonStringToLex } from '@atproto/lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ params }) => {
    const { repo, collection, rkey, cid } = params
    const db = ctx.db.getReplica()
    const did = await ctx.services.actor(db).getActorDid(repo)
    if (!did) {
      throw new InvalidRequestError(`Could not find repo: ${repo}`)
    }

    const uri = AtUri.make(did, collection, rkey)

    let builder = db.db
      .selectFrom('record')
      .selectAll()
      .where('uri', '=', uri.toString())
    if (cid) {
      builder = builder.where('cid', '=', cid)
    }

    const record = await builder.executeTakeFirst()
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: {
        uri: record.uri,
        cid: record.cid,
        value: jsonStringToLex(record.json) as Record<string, unknown>,
      },
    }
  })
}
