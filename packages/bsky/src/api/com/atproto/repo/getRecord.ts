import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: ctx.createHandler(
      async (ctx) => {
        const { repo, collection, rkey, cid } = ctx.params

        const [did] = await ctx.hydrator.actor.getDids([repo])
        if (!did) {
          throw new InvalidRequestError(`Could not find repo: ${repo}`)
        }

        const actors = await ctx.hydrator.actor.getActors(
          [did],
          ctx.includeTakedowns,
        )
        if (!actors.get(did)) {
          throw new InvalidRequestError(`Could not find repo: ${repo}`)
        }

        const uri = AtUri.make(did, collection, rkey).toString()
        const result = await ctx.hydrator.getRecord(uri, ctx.includeTakedowns)

        if (!result || (cid && result.cid !== cid)) {
          throw new InvalidRequestError(`Could not locate record: ${uri}`)
        }

        return {
          encoding: 'application/json',
          body: {
            uri: uri,
            cid: result.cid,
            value: result.record,
          },
        }
      },
      {
        includeTakedowns: true,
      },
    ),
  })
}
