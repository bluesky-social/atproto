import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.repo.getRecord, async ({ req, params }) => {
    const { repo, collection, rkey, cid } = params
    const did = await ctx.accountManager.getDidForActor(repo)

    // fetch from pds if available, if not then fetch from appview
    if (did) {
      const uri = AtUri.make(did, collection, rkey)
      const record = await ctx.actorStore.read(did, (store) =>
        store.record.getRecord(uri, cid ?? null),
      )
      if (!record || record.takedownRef !== null) {
        throw new InvalidRequestError(
          `Could not locate record: ${uri}`,
          'RecordNotFound',
        )
      }
      return {
        encoding: 'application/json' as const,
        body: {
          uri: uri.toString(),
          cid: record.cid,
          value: record.value,
        },
      }
    }

    if (!ctx.cfg.bskyAppView) {
      throw new InvalidRequestError(`Could not locate record`)
    }

    return pipethrough(ctx, req)
  })
}
