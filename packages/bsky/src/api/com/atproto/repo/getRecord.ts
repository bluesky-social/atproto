import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord({
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ auth, params }) => {
      const { repo, collection, rkey, cid } = params
      const { includeTakedowns } = ctx.authVerifier.parseCreds(auth)
      const [did] = await ctx.hydrator.actor.getDids([repo])
      if (!did) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      }

      const actors = await ctx.hydrator.actor.getActors([did], includeTakedowns)
      if (!actors.get(did)) {
        throw new InvalidRequestError(`Could not find repo: ${repo}`)
      }

      const uri = AtUri.make(did, collection, rkey).toString()
      const result = await ctx.hydrator.getRecord(uri, includeTakedowns)

      if (!result || (cid && result.cid !== cid)) {
        throw new InvalidRequestError(`Could not locate record: ${uri}`)
      }

      return {
        encoding: 'application/json' as const,
        body: {
          uri: uri,
          cid: result.cid,
          value: result.record,
        },
      }
    },
  })
}
